package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// rpcRequest is the incoming HTTP payload
type rpcRequest struct {
	Raw json.RawMessage `json:"request"`
}

func (r *rpcRequest) Trim() string {
	var js any
	if err := json.Unmarshal(r.Raw, &js); err != nil {
		return string(bytes.TrimSpace(r.Raw))
	}
	clean, _ := json.Marshal(js)
	return string(clean)
}

type stdinWriter struct {
	w *bufio.Writer
}

func NewStdinWriter(w io.Writer) *stdinWriter {
	bw := bufio.NewWriter(w)
	return &stdinWriter{w: bw}
}

func (w *stdinWriter) Write(p []byte) (n int, err error) {
	fmt.Println("-----")
	fmt.Println("stdin:", strings.TrimSuffix(string(p), "\n"))
	fmt.Println("-----")

	return w.w.Write(p)
}
func (w *stdinWriter) Flush() error {
	return w.w.Flush()
}

func main() {
	// Start Bun tsserver wrapper
	cmd := exec.Command("bun", "test/buntsserver.ts")

	stdin, err := cmd.StdinPipe()
	if err != nil {
		fmt.Printf("Error creating stdin pipe: %v\n", err)
		os.Exit(1)
	}

	// use a pipe to capture stdout for parsing
	pr, pw := io.Pipe()

	// send output both to terminal and pipe
	cmd.Stdout = io.MultiWriter(os.Stdout, pw)
	cmd.Stderr = os.Stderr

	cmd.Dir = "/var/web_dev/tools/volar-vue-ext"
	cmd.Env = os.Environ()
	cmd.WaitDelay = 20 * time.Minute

	if err := cmd.Start(); err != nil {
		fmt.Printf("Failed to start tsserver: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Starting tsserver...")
	fmt.Printf("Command: %s %s\n", cmd.Path, cmd.Args[1:])

	// bufio.Reader is now connected to the pipe
	reader := bufio.NewReader(pr)
	bufWriter := NewStdinWriter(stdin)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "failed to read body", http.StatusBadRequest)
			return
		}

		var req rpcRequest
		if err := json.Unmarshal(body, &req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		// Send clean JSON into tsserver
		if _, err := fmt.Fprintln(bufWriter, req.Trim()); err != nil {
			http.Error(w, "failed to write to tsserver", http.StatusInternalServerError)
			return
		}
		bufWriter.Flush()

		// --- Read response back ---
		// Expect "Content-Length: N\n\n<json>"
		line, err := reader.ReadString('\n')
		if err != nil {
			http.Error(w, "failed to read response header", http.StatusInternalServerError)
			return
		}
		line = strings.TrimSpace(line)

		if !strings.HasPrefix(line, "Content-Length:") {
			http.Error(w, "unexpected response header: "+line, http.StatusInternalServerError)
			return
		}

		lengthStr := strings.TrimSpace(strings.TrimPrefix(line, "Content-Length:"))
		n, _ := strconv.Atoi(lengthStr)

		// consume the blank line
		blank, _ := reader.ReadString('\n')
		if strings.TrimSpace(blank) != "" {
			http.Error(w, "expected blank line", http.StatusInternalServerError)
			return
		}

		// read JSON body
		buf := make([]byte, n)
		if _, err := io.ReadFull(reader, buf); err != nil {
			http.Error(w, "failed to read response body", http.StatusInternalServerError)
			return
		}

		// Return full framed response back to HTTP client
		resp := fmt.Sprintf("Content-Length: %d\n\n%s", n, string(buf))
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte(resp))
	})

	fmt.Println("HTTP server listening on :1234")
	if err := http.ListenAndServe(":1234", nil); err != nil {
		fmt.Printf("HTTP server error: %v\n", err)
		os.Exit(1)
	}

	cmd.Wait()
}
