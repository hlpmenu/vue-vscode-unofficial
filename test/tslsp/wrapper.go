package main

import (
	"fmt"
	"os"
	"os/exec"
	"time"
)

func main() {
	cmd := exec.Command("bunx", "--bun", "typescript-language-server", "--stdio", "--log-level", "4")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = "/var/web_dev/tools/volar-vue-ext"
	cmd.Env = os.Environ()
	cmd.WaitDelay = 20 * time.Minute
	cmd.Stdin = os.Stdin

	fmt.Println("Starting tsserver...")
	fmt.Printf("Command: %s %s\n", cmd.Path, cmd.Args[1:])

	err := cmd.Run()
	cmd.Wait()
	if err != nil {
		fmt.Printf("tsserver exited with error: %v\n", err)
		os.Exit(1)
	}

}
