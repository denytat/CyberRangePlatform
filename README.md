# 🛡️ CyberRange

### Enterprise-Grade, Team-Based Cybersecurity Training Platform

CyberRange is a modern SaaS platform designed to train cybersecurity teams through realistic, isolated attack scenarios. Built around the MITRE ATT&CK framework, it allows Team Captains to deploy vulnerable infrastructure on-demand, enabling squads to practice reconnaissance, exploitation, and flag capture in a safe, legally compliant environment.

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.21%2B-blue?style=for-the-badge&logo=go" alt="Go Version">
  <img src="https://img.shields.io/badge/Docker-Engine-2496ED?style=for-the-badge&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS">
</p>

---

## 🎯 Key Features (MVP)

- **Team-Centric Gameplay:** Users cannot play alone. Players must form teams, with designated roles (Captain/Attacker) to start scenarios.
- **Dynamic Orchestration:** The Go backend utilizes the Docker Engine API to spin up isolated, ephemeral Linux containers for each session on demand.
- **ATT&CK Mapping:** Every scenario in the database is tagged with MITRE ATT&CK Tactics and Technique IDs (e.g., `T1046`) for structured learning.
- **Role-Based UI:** A clean, modern UI (Tailwind CSS) that adapts based on user role—Captains control deployment, while Attackers wait for live environment access.
- **Real-Time State Sync:** Utilizes background polling to ensure team members see live roster updates and scenario deployments without requiring page refreshes.

---

## 🏗️ Architecture

CyberRange follows a strict separation of concerns between the **Control Plane** and the **Data Plane**:

- **Control Plane (Go Backend):** A high-performance HTTP API built in Go. It handles user authentication, team management, game logic, and serves the frontend.
- **Data Plane (Docker):** Isolated Docker containers running on the host machine. The Control Plane communicates with the Docker daemon via the Docker SDK to create and destroy "ranges".
- **State Management (Supabase):** A cloud PostgreSQL database tracks Users, Teams, Scenarios, and active Sessions.

```text
[ Browser (JS) ] ⇄ [ Go API (Control Plane) ] ⇄ [ Supabase (Postgres) ]
                                                        ⇅
                                          [ Docker Engine API ]
                                                        ⇅
                                              [ Isolated Containers ]
```

---

## 💻 Tech Stack

- **Backend:** Go 1.21+, `pgx` (Postgres driver), `docker/docker SDK`, `bcrypt`
- **Frontend:** Vanilla JavaScript, Tailwind CSS (via CDN)
- **Database:** Supabase (Hosted PostgreSQL)
- **Infrastructure:** Docker Desktop (Local execution)

---

## 🚀 Local Setup

### Prerequisites

- [Go 1.21+](https://golang.org/dl/) installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Supabase](https://supabase.com/) account & project

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/cyberrange.git
cd cyberrange
go mod download
```

### 2. Database Setup

1. Go to your Supabase project SQL Editor.
2. Run the schema located in `docs/schema.sql` to generate the `users`, `teams`, `team_members`, `scenarios`, and `sessions` tables.
3. Seed a test scenario into the `scenarios` table.

### 3. Environment Variables

Open `internal/db/supabase.go` and replace the placeholder with your Supabase Connection String (Transaction Pooler URI):

```go
var connectionString = "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

### 4. Run the Application

Ensure Docker Desktop is running, then execute:

```bash
go run cmd/server/main.go
```

Access the platform at **`http://localhost:8080/index.html`**

---

## 🗺️ Roadmap

### Phase 1: The Engine (Current MVP)

- [x] User authentication & Team management
- [x] Docker container orchestration API
- [x] Role-based UI & State polling

### Phase 2: The Hacker Interface

- [ ] Web-based terminal integration (`xterm.js` + WebSockets)
- [ ] Custom vulnerable Docker images (Web apps, SSH services)
- [ ] Flag hiding inside containers (instead of DB)

### Phase 3: Enterprise Readiness

- [ ] JWT Authentication & Secure session cookies
- [ ] Docker-in-Docker deployment for cloud hosting (DigitalOcean/AWS)
- [ ] Team statistics, leaderboards, and time-tracking

---
