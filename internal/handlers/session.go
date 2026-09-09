package handlers

import (
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/client"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/romanButkus/cyberrange/internal/docker"
)

type SessionHandler struct {
    Conn *pgxpool.Pool
}

type StartSessionRequest struct {
    TeamID     string `json:"team_id"`
    ScenarioID string `json:"scenario_id"`
}

func (h *SessionHandler) Start(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req StartSessionRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    // 1. Find the Docker image
    var dockerImage string
    err := h.Conn.QueryRow(context.Background(), 
        "SELECT docker_image FROM scenarios WHERE id = $1", 
        req.ScenarioID,
    ).Scan(&dockerImage)

    if err != nil {
        http.Error(w, "Scenario not found", http.StatusNotFound)
        return
    }

    // 2. Generate a Random Flag
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
    b := make([]byte, 8)
    for i := range b {
        b[i] = charset[rand.Intn(len(charset))]
    }
    flagString := "FLAG{" + string(b) + "}"

    // 3. Start the container
    containerID, err := docker.StartContainer(dockerImage)
    if err != nil {
        http.Error(w, "Failed to start hacking environment: "+err.Error(), http.StatusInternalServerError)
        return
    }

    // 4. Inject the flag into the container (Docker exec)
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        http.Error(w, "Docker connection failed", http.StatusInternalServerError)
        return
    }
    
    // We run the shell command to echo the flag into a file
    execCreate, err := cli.ContainerExecCreate(context.Background(), containerID, types.ExecConfig{
        Cmd:          []string{"sh", "-c", "echo " + flagString + " > /flag.txt"},
        AttachStdout: false,
    })
    if err != nil {
        http.Error(w, "Failed to write flag to container: "+err.Error(), http.StatusInternalServerError)
        return
    }
    
    if err := cli.ContainerExecAttach(context.Background(), execCreate); err != nil {
        http.Error(w, "Failed to attach exec: "+err.Error(), http.StatusInternalServerError)
        return
    }

    // 5. Save the session to the Database (with the NEW random flag)
    sessionID := uuid.New().String()
    expiresAt := time.Now().Add(1 * time.Hour)

    _, err = h.Conn.Exec(context.Background(), 
        "INSERT INTO sessions (id, team_id, scenario_id, container_id, status, expires_at, actual_flag) VALUES ($1, $2, $3, $4, 'running', $5, $6)", 
        sessionID, req.TeamID, req.ScenarioID, containerID, expiresAt, flagString,
    )
    if err != nil {
        http.Error(w, "Failed to save session", http.StatusInternalServerError)
        return
    }

    // 6. Return success
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message":      "Hacking environment started! Good luck.",
        "session_id":   sessionID,
        "container_id": containerID,
    })
}

type SubmitFlagRequest struct {
    SessionID     string `json:"session_id"`
    SubmittedFlag string `json:"submitted_flag"`
}

func (h *SessionHandler) SubmitFlag(w http.ResponseWriter, r *http.Request) {

    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req SubmitFlagRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    w.Header().Set("Content-Type", "application/json")

    var scenarioID string
    var containerID *string
    err := h.Conn.QueryRow(context.Background(),
        "SELECT scenario_id, container_id FROM sessions WHERE id = $1",
        req.SessionID,
    ).Scan(&scenarioID, &containerID)
    if err != nil {
        if err == pgx.ErrNoRows {
            w.WriteHeader(http.StatusNotFound)
            json.NewEncoder(w).Encode(map[string]string{"message": "Session not found", "error": "session_not_found"})
            return
        }
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{"message": "Failed to load session", "error": err.Error()})
        return
    }

    // UPDATED: Query the sessions table for the actual_flag (randomly generated)
    var actualFlag string
    err = h.Conn.QueryRow(context.Background(),
        "SELECT actual_flag FROM sessions WHERE id = $1",
        req.SessionID,
    ).Scan(&actualFlag)

    if err != nil {
        w.WriteHeader(http.StatusInternalServerError)
        json.NewEncoder(w).Encode(map[string]string{"message": "Failed to load flag for this session", "error": err.Error()})
        return
    }

    submitted := strings.TrimSpace(req.SubmittedFlag)
    expected := strings.TrimSpace(actualFlag)
    if submitted == expected {
        // Update DB status to completed
        h.Conn.Exec(context.Background(),
            "UPDATE sessions SET status = 'completed' WHERE id = $1",
            req.SessionID,
        )
        // Stop the container
        if containerID != nil && *containerID != "" {
            _ = docker.StopContainer(*containerID)
        }

        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{
            "message": "🎉 Congratulations! You found the flag!",
            "status":  "completed",
        })
        return
    }

    w.WriteHeader(http.StatusUnauthorized)
    json.NewEncoder(w).Encode(map[string]string{
        "message": "❌ Incorrect flag. Keep hacking!",
        "status":  "running",
    })
}

func (h *SessionHandler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
    teamID := r.URL.Query().Get("team_id")
    if teamID == "" {
        http.Error(w, "Missing team_id", http.StatusBadRequest)
        return
    }

    var sessionID, status string
    var containerID *string
    err := h.Conn.QueryRow(context.Background(),
        `SELECT id, container_id, status FROM sessions
         WHERE team_id = $1
         ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, expires_at DESC
         LIMIT 1`,
        teamID,
    ).Scan(&sessionID, &containerID, &status)

    if err != nil {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"message": "no_active_session"})
        return
    }

    cid := ""
    if containerID != nil {
        cid = *containerID
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "session_id":   sessionID,
        "container_id": cid,
        "status":       status,
    })
}