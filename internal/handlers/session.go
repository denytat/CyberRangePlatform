package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

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

    // 1. Find out which Docker image this scenario needs
    var dockerImage string
    err := h.Conn.QueryRow(context.Background(), 
        "SELECT docker_image FROM scenarios WHERE id = $1", 
        req.ScenarioID,
    ).Scan(&dockerImage)

    if err != nil {
        http.Error(w, "Scenario not found", http.StatusNotFound)
        return
    }

    // 2. Tell Docker to spin up the container
    containerID, err := docker.StartContainer(dockerImage)
    if err != nil {
        http.Error(w, "Failed to start hacking environment: "+err.Error(), http.StatusInternalServerError)
        return
    }

    // 3. Save the session to the database
    sessionID := uuid.New().String()
    expiresAt := time.Now().Add(1 * time.Hour) // Auto-destroy in 1 hour

    _, err = h.Conn.Exec(context.Background(), 
        "INSERT INTO sessions (id, team_id, scenario_id, container_id, status, expires_at) VALUES ($1, $2, $3, $4, 'running', $5)", 
        sessionID, req.TeamID, req.ScenarioID, containerID, expiresAt,
    )
    if err != nil {
        http.Error(w, "Failed to save session", http.StatusInternalServerError)
        return
    }

    // 4. Tell the frontend it worked!
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

    var realFlag string
    err = h.Conn.QueryRow(context.Background(),
        "SELECT flag FROM scenarios WHERE id = $1",
        scenarioID,
    ).Scan(&realFlag)
    if err != nil {
        w.WriteHeader(http.StatusNotFound)
        json.NewEncoder(w).Encode(map[string]string{"message": "Scenario not found", "error": "scenario_not_found"})
        return
    }

    submitted := strings.TrimSpace(req.SubmittedFlag)
    expected := strings.TrimSpace(realFlag)
    if submitted == expected {
        h.Conn.Exec(context.Background(),
            "UPDATE sessions SET status = 'completed' WHERE id = $1",
            req.SessionID,
        )
        if containerID != nil && *containerID != "" {
            _ = docker.StopContainer(*containerID)
        }

        json.NewEncoder(w).Encode(map[string]string{
            "message": "🎉 Congratulations! You found the flag!",
            "status":  "completed",
        })
        return
    }

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