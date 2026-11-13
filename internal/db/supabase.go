package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var connectionString = "YOUR_CONNECTIONSTRING"

func Connect() *pgxpool.Pool {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    pool, err := pgxpool.New(ctx, connectionString)
    if err != nil {
        log.Fatalf("Unable to connect to database: %v\n", err)
    }

    fmt.Println("✅ Successfully connected to Supabase!")
    return pool
}
