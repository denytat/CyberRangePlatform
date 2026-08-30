package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/romanButkus/cyberrange/internal/docker"
)

type SessionHandler struct {
    Conn *pgx.Conn
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

    // 1. Find out which scenario this session is playing
    var scenarioID string
    err := h.Conn.QueryRow(context.Background(), 
        "SELECT scenario_id FROM sessions WHERE id = $1", 
        req.SessionID,
    ).Scan(&scenarioID)

    if err != nil {
        http.Error(w, "Session not found", http.StatusNotFound)
        return
    }

    // 2. Get the real flag for that scenario
    var realFlag string
    err = h.Conn.QueryRow(context.Background(), 
        "SELECT flag FROM scenarios WHERE id = $1", 
        scenarioID,
    ).Scan(&realFlag)

    if err != nil {
        http.Error(w, "Scenario not found", http.StatusNotFound)
        return
    }

    // 3. Check if they are correct
    w.Header().Set("Content-Type", "application/json")
    if req.SubmittedFlag == realFlag {
        
        // Update session status to completed!
        h.Conn.Exec(context.Background(), 
            "UPDATE sessions SET status = 'completed' WHERE id = $1", 
            req.SessionID,
        )

        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]string{
            "message": "🎉 Congratulations! You found the flag!",
        })
    } else {
        w.WriteHeader(http.StatusUnauthorized)
        json.NewEncoder(w).Encode(map[string]string{
            "message": "❌ Incorrect flag. Keep hacking!",
        })
    }
}

func (h *SessionHandler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
    teamID := r.URL.Query().Get("team_id")
    if teamID == "" {
        http.Error(w, "Missing team_id", http.StatusBadRequest)
        return
    }

    var sessionID, containerID string
    // Check if there is a running session for this team
    err := h.Conn.QueryRow(context.Background(), 
        "SELECT id, container_id FROM sessions WHERE team_id = $1 AND status = 'running' LIMIT 1", 
        teamID,
    ).Scan(&sessionID, &containerID)

    if err != nil {
        // No active game found
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(map[string]string{"message": "no_active_session"})
        return
    }

    // Game is active!
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "session_id":   sessionID,
        "container_id": containerID,
    })
}