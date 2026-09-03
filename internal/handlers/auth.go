package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
    Conn *pgxpool.Pool
}

type RegisterRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
    // 1. Ensure it's a POST request
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // 2. Read the JSON body from the user
    var req RegisterRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    // 3. Hash the password
    hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        http.Error(w, "Error hashing password", http.StatusInternalServerError)
        return
    }

    // 4. Generate a new UUID for the user
    userID := uuid.New().String()

    // 5. Save to Supabase
    // NOTE: Postgres uses $1, $2 instead of ? for placeholders!
    _, err = h.Conn.Exec(context.Background(), 
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", 
        userID, req.Email, string(hash),
    )
    if err != nil {
        http.Error(w, "Failed to create user (email might already exist)", http.StatusConflict)
        return
    }

    // 6. Return success to the frontend
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(map[string]string{
        "id":    userID,
        "email": req.Email,
    })
}

type LoginRequest struct {
    Email string `json:"email"`
    Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    // 1. Find the user in the database by email
    var userID, hashedPassword string
    err := h.Conn.QueryRow(context.Background(), 
        "SELECT id, password_hash FROM users WHERE email = $1", 
        req.Email,
    ).Scan(&userID, &hashedPassword)

    if err != nil {
        http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        return
    }

    // 2. Compare the password they typed with the hash in the database
    err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password))
    if err != nil {
        http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        return
    }

    // 3. Success! (In a real app, we would generate a JWT token here)
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Login successful",
        "user_id": userID,
    })
}