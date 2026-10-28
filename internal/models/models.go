package models

import "time"

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type TeamMember struct {
	ID        string    `json:"id"`
	TeamID    string    `json:"team_id"`
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Scenario struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	AttackTactic      string `json:"attack_tactic"`
	AttackTechniqueID string `json:"attack_technique_id"`
	DockerImage       string `json:"docker_image"`
	Difficulty        string `json:"difficulty"`
	Flags             string `json:"-"`
}

type Session struct {
	ID                 string     `json:"id"`
	TeamID             string     `json:"team_id"`
	ScenarioID         string     `json:"scenario_id"`
	ScenarioName       string     `json:"scenario_name"`
	ScenarioDescription string    `json:"scenario_description"`
	Difficulty         string     `json:"difficulty"`
	ContainerID        string     `json:"container_id"`
	Status             string     `json:"status"`
	WinnerUserID       *string    `json:"winner_user_id,omitempty"`
	StartedAt          time.Time  `json:"started_at"`
	CompletedAt        *time.Time `json:"completed_at,omitempty"`
	ExpiresAt          time.Time  `json:"expires_at"`
}
