package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
)

// TerminalHandler upgrades a browser socket to a Docker exec terminal.
//
// Wiring example in cmd/server/main.go:
//
//	terminalHandler := &handlers.TerminalHandler{}
//	mux.HandleFunc("/ws/terminal", terminalHandler.HandleUpgrade)
//
// Wiring example in logic.js:
//
//	function initTerminal(containerId) {
//		const ws = new WebSocket(`ws://${location.host}/ws/terminal?container_id=${containerId}`)
//		ws.addEventListener("open", () => {
//			ws.send(JSON.stringify({ type: "exec", command: "pwd" }))
//		})
//		ws.addEventListener("message", event => {
//			term.write(event.data)
//		})
//	}
//
// This keeps the browser terminal connected to a live shell inside the target container.
type TerminalHandler struct{}

type terminalMessage struct {
	Type    string `json:"type"`
	Command string `json:"command"`
}

type wsOutputWriter struct {
	conn *websocket.Conn
}

func (w *wsOutputWriter) Write(p []byte) (int, error) {
	if err := w.conn.WriteMessage(websocket.TextMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

// HandleUpgrade upgrades an HTTP request to a WebSocket and runs a Docker exec loop.
func (h *TerminalHandler) HandleUpgrade(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var msg terminalMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		if msg.Type != "exec" {
			continue
		}

		cmd := strings.TrimSpace(msg.Command)
		if cmd == "" {
			continue
		}

		containerID := r.URL.Query().Get("container_id")
		if containerID == "" {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("missing container_id\n"))
			continue
		}

		if err := h.runExec(conn, containerID, cmd); err != nil {
			_ = conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("terminal error: %v\n", err)))
		}
	}
}

func (h *TerminalHandler) runExec(conn *websocket.Conn, containerID, command string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return err
	}
	defer cli.Close()

	execConfig := container.ExecOptions{
		Cmd:          []string{"sh", "-c", command},
		AttachStdout: true,
		AttachStderr: true,
	}

	execCreate, err := cli.ContainerExecCreate(context.Background(), containerID, execConfig)
	if err != nil {
		return err
	}

	hijacked, err := cli.ContainerExecAttach(context.Background(), execCreate.ID, container.ExecStartOptions{})
	if err != nil {
		return err
	}
	defer hijacked.Close()

	_, err = io.Copy(&wsOutputWriter{conn: conn}, hijacked.Reader)
	if err != nil {
		return err
	}

	return nil
}
