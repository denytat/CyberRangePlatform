package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

type LeaveTeamRequest struct {
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

	_, err := h.Conn.Exec(context.Background(),
		"INSERT INTO teams (id, name) VALUES ($1, $2)",
		teamID, req.Name,
	)
	if err != nil {
		http.Error(w, "Failed to create team", http.StatusInternalServerError)
		return
	}

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
		"message":   "Team created successfully",
		"team_id":   teamID,
		"team_name": req.Name,
		"role":      "Captain",
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

	var teamName string
	err := h.Conn.QueryRow(context.Background(),
		"SELECT name FROM teams WHERE id = $1",
		req.TeamID,
	).Scan(&teamName)
	if err != nil {
		http.Error(w, "Failed to join team (does the team ID exist?)", http.StatusBadRequest)
		return
	}

	memberID := uuid.New().String()
	_, err = h.Conn.Exec(context.Background(),
		"INSERT INTO team_members (id, team_id, user_id, role) VALUES ($1, $2, $3, 'Attacker')",
		memberID, req.TeamID, req.UserID,
	)
	if err != nil {
		http.Error(w, "Failed to join team (does the team ID exist?)", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "Successfully joined team",
		"team_id":   req.TeamID,
		"team_name": teamName,
		"role":      "Attacker",
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

func (h *TeamHandler) LeaveTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LeaveTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" || req.TeamID == "" {
		http.Error(w, "Missing user_id or team_id", http.StatusBadRequest)
		return
	}

	var role string
	err := h.Conn.QueryRow(context.Background(),
		"SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2",
		req.TeamID, req.UserID,
	).Scan(&role)
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "You are not a member of this team", http.StatusBadRequest)
			return
		}
		http.Error(w, "Failed to load membership", http.StatusInternalServerError)
		return
	}

	var newCaptainID *string

	if strings.EqualFold(role, "captain") {
		var successorID string
		err = h.Conn.QueryRow(context.Background(),
			`SELECT user_id FROM team_members
			 WHERE team_id = $1 AND user_id != $2
			 ORDER BY id ASC
			 LIMIT 1`,
			req.TeamID, req.UserID,
		).Scan(&successorID)
		if err == nil && successorID != "" {
			_, _ = h.Conn.Exec(context.Background(),
				"UPDATE team_members SET role = 'Captain' WHERE team_id = $1 AND user_id = $2",
				req.TeamID, successorID,
			)
			newCaptainID = &successorID
		}
	}

	_, err = h.Conn.Exec(context.Background(),
		"DELETE FROM team_members WHERE team_id = $1 AND user_id = $2",
		req.TeamID, req.UserID,
	)
	if err != nil {
		http.Error(w, "Failed to leave team", http.StatusInternalServerError)
		return
	}

	var remaining int
	_ = h.Conn.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM team_members WHERE team_id = $1",
		req.TeamID,
	).Scan(&remaining)
	if remaining == 0 {
		_, _ = h.Conn.Exec(context.Background(),
			"DELETE FROM teams WHERE id = $1",
			req.TeamID,
		)
	}

	resp := map[string]interface{}{
		"success": true,
	}
	if newCaptainID != nil {
		resp["new_captain_id"] = *newCaptainID
	} else {
		resp["new_captain_id"] = nil
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
