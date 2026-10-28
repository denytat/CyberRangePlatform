package docker

import (
	"context"
	"fmt"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

func resolveContainerImage(imageName string) string {
	normalized := strings.TrimSpace(imageName)
	switch normalized {
	case "", "ssh", "ssh:latest":
		return "alpine:latest"
	default:
		return normalized
	}
}

// StartContainer spins up a container and returns its ID
func StartContainer(imageName string) (string, error) {
	imageName = resolveContainerImage(imageName)

	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return "", fmt.Errorf("failed to connect to Docker: %v", err)
	}
	defer cli.Close()

	resp, err := cli.ContainerCreate(context.Background(),
		&container.Config{
			Image: imageName,
			Cmd:   []string{"sleep", "3600"},
			Tty:   false,
		},
		nil,
		nil,
		nil,
		"",
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %v", err)
	}

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
	defer cli.Close()

	timeout := 5
	stopOpts := container.StopOptions{Timeout: &timeout}
	if err := cli.ContainerStop(context.Background(), containerID, stopOpts); err != nil {
		return fmt.Errorf("failed to stop container: %v", err)
	}
	return nil
}

// StopAndRemoveContainer stops then removes a container.
func StopAndRemoveContainer(containerID string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return fmt.Errorf("failed to connect to Docker: %v", err)
	}
	defer cli.Close()

	timeout := 5
	stopOpts := container.StopOptions{Timeout: &timeout}
	_ = cli.ContainerStop(context.Background(), containerID, stopOpts)

	if err := cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{Force: true}); err != nil {
		return fmt.Errorf("failed to remove container: %v", err)
	}
	return nil
}
