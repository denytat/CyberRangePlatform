package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

// StartContainer spins up a container and returns its ID
func StartContainer(imageName string) (string, error) {
    // 1. Connect to the local Docker Engine (Docker Desktop)
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        return "", fmt.Errorf("failed to connect to Docker: %v", err)
    }

    // 2. Create the container (but don't start it yet)
    // We use "alpine" as a safe, tiny Linux OS for testing
    resp, err := cli.ContainerCreate(context.Background(), 
        &container.Config{
            Image: imageName,
            Cmd:   []string{"sleep", "300"}, // Keeps the container alive for 5 minutes for testing
            Tty:   false,
        },
        nil, // HostConfig (networking, ports etc - we keep it simple for now)
        nil, // NetworkingConfig
        nil, // Platform
        "",  // Container name (leave blank to auto-generate)
    )
    if err != nil {
        return "", fmt.Errorf("failed to create container: %v", err)
    }

    // 3. Start the container
    if err := cli.ContainerStart(context.Background(), resp.ID, container.StartOptions{}); err != nil {
        return "", fmt.Errorf("failed to start container: %v", err)
    }

    return resp.ID, nil
}

func StopContainer(containerID string) error {
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        return fmt.Errorf("failed to connect to Docker: %v", err)
    }

    timeout := 5
    stopOpts := container.StopOptions{Timeout: &timeout}
    if err := cli.ContainerStop(context.Background(), containerID, stopOpts); err != nil {
        return fmt.Errorf("failed to stop container: %v", err)
    }
    return nil
}