package main

import (
	"log"
	"net/http"

	"github.com/romanButkus/cyberrange/internal/db"
	"github.com/romanButkus/cyberrange/internal/handlers"
)

func main() {
    // 1. Connect to Database
    conn := db.Connect()
    defer conn.Close()

    // 2. Initialize Handlers
    authHandler := &handlers.AuthHandler{Conn: conn}
    teamHandler := &handlers.TeamHandler{Conn: conn}
    sessionHandler := &handlers.SessionHandler{Conn: conn}

    // 3. Create Routes
    mux := http.NewServeMux()
    mux.Handle("/", http.FileServer(http.Dir("./web/static")))
    mux.HandleFunc("POST /api/register", authHandler.Register)
    mux.HandleFunc("POST /api/login", authHandler.Login)
    mux.HandleFunc("POST /api/teams/create", teamHandler.CreateTeam)
    mux.HandleFunc("POST /api/teams/join", teamHandler.JoinTeam)
    mux.HandleFunc("GET /api/teams/members", teamHandler.GetMembers)
    mux.HandleFunc("POST /api/sessions/start", sessionHandler.Start)
    mux.HandleFunc("POST /api/sessions/submit-flag", sessionHandler.SubmitFlag)
    mux.HandleFunc("GET /api/sessions/active", sessionHandler.GetActiveSession)

    // 4. Start Server
    log.Println("🚀 CyberRange API running on http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", mux))
}