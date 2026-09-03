package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TeamHandler struct {
    Conn *pgxpool.Pool
}

type CreateTeamRequest struct {
    UserID string `json:"user_id"`
    Name   string `json:"name"`
}

type JoinTeamRequest struct {
    UserID string `json:"user_id"`
    TeamID string `json:"team_id"`
}

func (h *TeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req CreateTeamRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    teamID := uuid.New().String()
    memberID := uuid.New().String()

    // 1. Create the team
    _, err := h.Conn.Exec(context.Background(), 
        "INSERT INTO teams (id, name) VALUES ($1, $2)", 
        teamID, req.Name,
    )
    if err != nil {
        http.Error(w, "Failed to create team", http.StatusInternalServerError)
        return
    }

    // 2. Automatically add the creator as the "Captain"
    _, err = h.Conn.Exec(context.Background(), 
        "INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, 'Captain')", 
        memberID, teamID, req.UserID,
    )
    if err != nil {
        http.Error(w, "Failed to add captain", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Team created successfully",
        "team_id": teamID,
    })
}

func (h *TeamHandler) JoinTeam(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req JoinTeamRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    memberID := uuid.New().String()

    // Add the user to the team as an "Attacker" (default role)
    _, err := h.Conn.Exec(context.Background(), 
        "INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, 'Attacker')", 
        memberID, req.TeamID, req.UserID,
    )
    if err != nil {
        http.Error(w, "Failed to join team (does the team ID exist?)", http.StatusBadRequest)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Successfully joined team",
    })
}

func (h *TeamHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
    teamID := r.URL.Query().Get("team_id")
    if teamID == "" {
        http.Error(w, "Missing team_id", http.StatusBadRequest)
        return
    }

    rows, err := h.Conn.Query(context.Background(), 
        "SELECT u.email, tm.role FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1", 
        teamID,
    )
    if err != nil {
        http.Error(w, "Failed to fetch members", http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    type Member struct {
        Email string `json:"email"`
        Role  string `json:"role"`
    }
    var members []Member

    for rows.Next() {
        var m Member
        if err := rows.Scan(&m.Email, &m.Role); err != nil {
            continue
        }
        members = append(members, m)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(members)
}