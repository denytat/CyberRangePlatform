package models

import "time"

type User struct {
	ID        string       `json:"id"`
	Email     string       `json:"email"`
	PasswordHash      string       `json:"-"`
	CreatedAt time.Time    `json:"created_at"`
}

type Team struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	CreatedAt time.Time    `json:"created_at"`
}

type TeamMember struct {
	ID        string       `json:"id"`
	TeamID    string       `json:"team_id"`
	UserID    string       `json:"user_id"`
	Role      string       `json:"role"`
}

type Scenario struct {
	ID				string       `json:"id"`
	Name			string       `json:"name"`
	Description		string       `json:"description"`
	AttackTactic		string       `json:"attack_tactic"`
	AttackTechniqueID		string       `json:"attack_technique_id"`
	DockerImage		string       `json:"docker_image"`
	Flags			string     `json:"-"`
}

type Session struct {
	ID        string       `json:"id"`
	TeamId		string       `json:"team_id"`
	ScenarioID string       `json:"scenario_id"`
	ContainerID	string       `json:"container_id"`
	Status		string       `json:"status"`
	StartedAt	time.Time    `json:"started_at"`
	ExpiresAt	time.Time    `json:"expires_at"`
}