package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
)

var connectionString = "postgresql://postgres.qfnezaaabgzgsfvqnimg:D2MJNLfjXbPsnpQB@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

func Connect() *pgx.Conn {
    // Add a 5-second timeout so the server doesn't freeze if Supabase is slow
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    conn, err := pgx.Connect(ctx, connectionString)
    if err != nil {
        log.Fatalf("Unable to connect to database: %v\n", err)
    }

    fmt.Println("✅ Successfully connected to Supabase!")
    return conn
}