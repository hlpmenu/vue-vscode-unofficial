package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"time"
)

func main() {
	go timeOut()

	// Change to the project root directory
	err := os.Chdir("../")
	if err != nil {
		log.Fatalf("Failed to change directory: %v", err)
	}

	log.Println("Starting tsserver via buntsserver.ts...")

	// Command to run the bun script
	//	cmd := exec.Command("bun", "buntsserver.ts")
	cmd := exec.Command("bun", "buntsserver.ts")
	// Pipe stdout and stderr directly
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		log.Fatalf("Failed to get stdin pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
	log.Println("Server process started.")

	// The 5-step request sequence
	requests := []string{
		// 1. Open a TS file to bootstrap a project
		`{"seq":1,"type":"request","command":"updateOpen","arguments":{"changedFiles":[],"closedFiles":[],"openFiles":[{"file":"/var/web_dev/tools/volar-vue-ext/test/bridge.ts","fileContent":"export const x = 1;"}]}}`,
		// 2. (Optional) Ask for project info
		`{"seq":2,"type":"request","command":"projectInfo","arguments":{"file":"/var/web_dev/tools/volar-vue-ext/test/bridge.ts","needFileNameList":false}}`,
		// 3. Open the .vue file
		`{"seq":3,"type":"request","command":"updateOpen","arguments":{"changedFiles":[],"closedFiles":[],"openFiles":[{"file":"/var/web_dev/tools/volar-vue-ext/test/App.vue","fileContent":"<template><div>{{ msg }}</div></template>\n<script setup lang=\"ts\">import { ref } from \"vue\"; const msg = ref(\"hello\");</script>"}]}}`,
		// 4. Verify the plugin’s Vue handlers are present
		`{"seq":4,"type":"request","command":"_vue:projectInfo","arguments":{"file":"/var/web_dev/tools/volar-vue-ext/test/App.vue","needFileNameList":false}}`,
		// 5. Now the original call should succeed
		`{"seq":5,"type":"request","command":"_vue:getReactiveReferences","arguments":["/var/web_dev/tools/volar-vue-ext/test/App.vue",27]}`,
	}

	// Write each request sequentially
	for i, req := range requests {
		time.Sleep(2 * time.Second) // Wait a moment between requests
		log.Printf("--> Sending Request #%d...", i+1)
		_, err := io.WriteString(stdin, req+"\n")
		if err != nil {
			log.Fatalf("Failed to write to stdin: %v", err)
		}
	}
	log.Println("All requests sent. Waiting for server to exit...")

	time.Sleep(time.Second * 2)
	cmd.Wait() // Wait for the process to finish
}

func timeOut() {
	time.Sleep(time.Second * 20)
	fmt.Println("All responses and notifications should have been received by now. Exiting...")
	log.Println("All requests sent. Waiting for server to exit...")
	os.Exit(0)
}
