package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/romanButkus/cyberrange/internal/docker"
	"github.com/romanButkus/cyberrange/internal/models"
)

type SessionHandler struct {
	Conn *pgxpool.Pool
}

type StartSessionRequest struct {
	TeamID     string `json:"team_id"`
	ScenarioID string `json:"scenario_id"`
}

type SubmitFlagRequest struct {
	SessionID     string `json:"session_id"`
	SubmittedFlag string `json:"submitted_flag"`
	UserID        string `json:"user_id"`
}

type EndSessionRequest struct {
	SessionID string `json:"session_id"`
}

func (h *SessionHandler) GetScenarios(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.Conn.Query(context.Background(),
		`SELECT id, name, description, attack_tactic, attack_technique_id, docker_image, COALESCE(difficulty, 'easy')
		 FROM scenarios
		 ORDER BY
		   CASE LOWER(COALESCE(difficulty, 'easy'))
		     WHEN 'easy' THEN 1
		     WHEN 'medium' THEN 2
		     WHEN 'hard' THEN 3
		     WHEN 'expert' THEN 4
		     ELSE 5
		   END,
		   name ASC`,
	)
	if err != nil {
		http.Error(w, "Failed to fetch scenarios", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	scenarios := make([]models.Scenario, 0)
	for rows.Next() {
		var s models.Scenario
		if err := rows.Scan(
			&s.ID, &s.Name, &s.Description, &s.AttackTactic,
			&s.AttackTechniqueID, &s.DockerImage, &s.Difficulty,
		); err != nil {
			continue
		}
		scenarios = append(scenarios, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scenarios)
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

	var dockerImage, scenarioName, scenarioDesc, difficulty string
	err := h.Conn.QueryRow(context.Background(),
		`SELECT docker_image, name, COALESCE(description, ''), COALESCE(difficulty, 'easy')
		 FROM scenarios WHERE id = $1`,
		req.ScenarioID,
	).Scan(&dockerImage, &scenarioName, &scenarioDesc, &difficulty)
	if err != nil {
		http.Error(w, "Scenario not found", http.StatusNotFound)
		return
	}

	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	flagString := fmt.Sprintf("CR{%s}", string(b))

	containerID, err := docker.StartContainer(dockerImage)
	if err != nil {
		http.Error(w, "Failed to start hacking environment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		http.Error(w, "Docker connection failed", http.StatusInternalServerError)
		return
	}
	defer cli.Close()

	motd := "CYBERRANGE MISSION BRIEFING\n" +
		"Your mission: Find the hidden flag and submit it.\n" +
		"Flag format: CR{...}\n" +
		"Useful: find / -name '*flag*' 2>/dev/null\n" +
		"Useful: grep -r 'CR{' / 2>/dev/null\n" +
		"Useful: cat /flag.txt\n" +
		"Type cat /etc/motd to see instructions again.\n"

	injectCmd := fmt.Sprintf(
		"echo %s > /flag.txt && mkdir -p /etc && printf '%%s' %s > /etc/motd",
		shellQuote(flagString),
		shellQuote(motd),
	)

	execCreate, err := cli.ContainerExecCreate(context.Background(), containerID, container.ExecOptions{
		Cmd:          []string{"sh", "-c", injectCmd},
		AttachStdout: false,
	})
	if err != nil {
		http.Error(w, "Failed to write flag to container: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := cli.ContainerExecStart(context.Background(), execCreate.ID, container.ExecStartOptions{}); err != nil {
		http.Error(w, "Failed to execute flag injection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(1 * time.Hour)

	_, err = h.Conn.Exec(context.Background(),
		`INSERT INTO sessions (
			id, team_id, scenario_id, container_id, status, expires_at, actual_flag,
			scenario_name, scenario_description, difficulty
		) VALUES ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9)`,
		sessionID, req.TeamID, req.ScenarioID, containerID, expiresAt, flagString,
		scenarioName, scenarioDesc, difficulty,
	)
	if err != nil {
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":              "Hacking environment started! Good luck.",
		"session_id":           sessionID,
		"container_id":         containerID,
		"scenario_name":        scenarioName,
		"scenario_description": scenarioDesc,
		"difficulty":           difficulty,
		"status":               "running",
	})
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'"'"'`) + "'"
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

	var containerID *string
	var actualFlag string
	var createdAt time.Time
	var scenarioName string
	err := h.Conn.QueryRow(context.Background(),
		`SELECT container_id, actual_flag, (expires_at - INTERVAL '1 hour'), COALESCE(scenario_name, '')
		 FROM sessions WHERE id = $1`,
		req.SessionID,
	).Scan(&containerID, &actualFlag, &createdAt, &scenarioName)
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

	submitted := strings.TrimSpace(req.SubmittedFlag)
	expected := strings.TrimSpace(actualFlag)
	if submitted != expected {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "❌ Incorrect flag. Keep hacking!",
			"status":  "running",
		})
		return
	}

	completedAt := time.Now()
	durationSeconds := int(completedAt.Sub(createdAt).Seconds())
	if durationSeconds < 0 {
		durationSeconds = 0
	}

	winnerID := req.UserID
	var winnerEmail, winnerRole string
	if winnerID != "" {
		_ = h.Conn.QueryRow(context.Background(),
			`SELECT u.email, COALESCE(tm.role, 'Attacker')
			 FROM users u
			 LEFT JOIN sessions s ON s.id = $1
			 LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = s.team_id
			 WHERE u.id = $2`,
			req.SessionID, winnerID,
		).Scan(&winnerEmail, &winnerRole)
	}

	_, _ = h.Conn.Exec(context.Background(),
		`UPDATE sessions
		 SET status = 'completed', winner_user_id = NULLIF($2, '')::uuid, completed_at = $3
		 WHERE id = $1`,
		req.SessionID, winnerID, completedAt,
	)

	if containerID != nil && *containerID != "" {
		_ = docker.StopAndRemoveContainer(*containerID)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"correct":          true,
		"message":          "🎉 Congratulations! You found the flag!",
		"status":           "completed",
		"winner_email":     winnerEmail,
		"winner_role":      winnerRole,
		"winner_user_id":   winnerID,
		"duration_seconds": durationSeconds,
		"completed_at":     completedAt.UTC().Format(time.RFC3339),
		"started_at":       createdAt.UTC().Format(time.RFC3339),
		"scenario_name":    scenarioName,
	})
}

func (h *SessionHandler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		http.Error(w, "Missing team_id", http.StatusBadRequest)
		return
	}

	var sessionID, status, scenarioName, scenarioDesc, difficulty string
	var containerID *string
	var scenarioID *string
	err := h.Conn.QueryRow(context.Background(),
		`SELECT id, container_id, status,
		        COALESCE(scenario_name, ''), COALESCE(scenario_description, ''),
		        COALESCE(difficulty, ''), scenario_id
		 FROM sessions
         WHERE team_id = $1
         ORDER BY CASE WHEN status = 'running' THEN 0 WHEN status = 'completed' THEN 1 ELSE 2 END, expires_at DESC
         LIMIT 1`,
		teamID,
	).Scan(&sessionID, &containerID, &status, &scenarioName, &scenarioDesc, &difficulty, &scenarioID)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "no_active_session"})
		return
	}

	cid := ""
	if containerID != nil {
		cid = *containerID
	}
	sid := ""
	if scenarioID != nil {
		sid = *scenarioID
	}

	resp := map[string]interface{}{
		"session_id":           sessionID,
		"container_id":         cid,
		"status":               status,
		"scenario_id":          sid,
		"scenario_name":        scenarioName,
		"scenario_description": scenarioDesc,
		"difficulty":           difficulty,
	}

	if status == "completed" {
		var winnerEmail, winnerRole string
		var durationSeconds int
		var completedAt, startedAt *time.Time
		_ = h.Conn.QueryRow(context.Background(),
			`SELECT
				COALESCE(u.email, ''),
				COALESCE(tm.role, ''),
				COALESCE(EXTRACT(EPOCH FROM (s.completed_at - (s.expires_at - INTERVAL '1 hour')))::int, 0),
				s.completed_at,
				(s.expires_at - INTERVAL '1 hour')
			 FROM sessions s
			 LEFT JOIN users u ON u.id = s.winner_user_id
			 LEFT JOIN team_members tm ON tm.user_id = s.winner_user_id AND tm.team_id = s.team_id
			 WHERE s.id = $1`,
			sessionID,
		).Scan(&winnerEmail, &winnerRole, &durationSeconds, &completedAt, &startedAt)
		resp["winner_email"] = winnerEmail
		resp["winner_role"] = winnerRole
		resp["duration_seconds"] = durationSeconds
		if completedAt != nil {
			resp["completed_at"] = completedAt.UTC().Format(time.RFC3339)
		}
		if startedAt != nil {
			resp["started_at"] = startedAt.UTC().Format(time.RFC3339)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *SessionHandler) End(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req EndSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.SessionID == "" {
		http.Error(w, "Missing session_id", http.StatusBadRequest)
		return
	}

	var containerID *string
	err := h.Conn.QueryRow(context.Background(),
		"SELECT container_id FROM sessions WHERE id = $1",
		req.SessionID,
	).Scan(&containerID)
	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to load session", http.StatusInternalServerError)
		return
	}

	if containerID != nil && *containerID != "" {
		_ = docker.StopAndRemoveContainer(*containerID)
	}

	_, err = h.Conn.Exec(context.Background(),
		"UPDATE sessions SET status = 'abandoned' WHERE id = $1",
		req.SessionID,
	)
	if err != nil {
		http.Error(w, "Failed to update session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func (h *SessionHandler) GetResult(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session_id")
	teamID := r.URL.Query().Get("team_id")

	type resultRow struct {
		SessionID       string
		ScenarioName    string
		WinnerEmail     string
		WinnerRole      string
		DurationSeconds int
		CompletedAt     *time.Time
		StartedAt       *time.Time
		Status          string
	}

	var row resultRow
	var err error

	if sessionID != "" {
		err = h.Conn.QueryRow(context.Background(),
			`SELECT s.id, COALESCE(s.scenario_name, ''), COALESCE(u.email, ''), COALESCE(tm.role, ''),
			        COALESCE(EXTRACT(EPOCH FROM (s.completed_at - (s.expires_at - INTERVAL '1 hour')))::int, 0),
			        s.completed_at, (s.expires_at - INTERVAL '1 hour'), s.status
			 FROM sessions s
			 LEFT JOIN users u ON u.id = s.winner_user_id
			 LEFT JOIN team_members tm ON tm.user_id = s.winner_user_id AND tm.team_id = s.team_id
			 WHERE s.id = $1`,
			sessionID,
		).Scan(&row.SessionID, &row.ScenarioName, &row.WinnerEmail, &row.WinnerRole,
			&row.DurationSeconds, &row.CompletedAt, &row.StartedAt, &row.Status)
	} else if teamID != "" {
		err = h.Conn.QueryRow(context.Background(),
			`SELECT s.id, COALESCE(s.scenario_name, ''), COALESCE(u.email, ''), COALESCE(tm.role, ''),
			        COALESCE(EXTRACT(EPOCH FROM (s.completed_at - (s.expires_at - INTERVAL '1 hour')))::int, 0),
			        s.completed_at, (s.expires_at - INTERVAL '1 hour'), s.status
			 FROM sessions s
			 LEFT JOIN users u ON u.id = s.winner_user_id
			 LEFT JOIN team_members tm ON tm.user_id = s.winner_user_id AND tm.team_id = s.team_id
			 WHERE s.team_id = $1 AND s.status = 'completed'
			 ORDER BY s.completed_at DESC NULLS LAST
			 LIMIT 1`,
			teamID,
		).Scan(&row.SessionID, &row.ScenarioName, &row.WinnerEmail, &row.WinnerRole,
			&row.DurationSeconds, &row.CompletedAt, &row.StartedAt, &row.Status)
	} else {
		http.Error(w, "Missing session_id or team_id", http.StatusBadRequest)
		return
	}

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "no_result"})
		return
	}

	resp := map[string]interface{}{
		"session_id":       row.SessionID,
		"scenario_name":    row.ScenarioName,
		"winner_email":     row.WinnerEmail,
		"winner_role":      row.WinnerRole,
		"duration_seconds": row.DurationSeconds,
		"status":           row.Status,
	}
	if row.CompletedAt != nil {
		resp["completed_at"] = row.CompletedAt.UTC().Format(time.RFC3339)
	}
	if row.StartedAt != nil {
		resp["started_at"] = row.StartedAt.UTC().Format(time.RFC3339)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
