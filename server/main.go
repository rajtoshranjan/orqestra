package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type deploymentLog struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

type lambdaEnvironmentVariable struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type lambdaConfig struct {
	FunctionName         string                      `json:"functionName"`
	Runtime              string                      `json:"runtime"`
	Handler              string                      `json:"handler"`
	Code                 string                      `json:"code"`
	EnvironmentVariables []lambdaEnvironmentVariable `json:"environmentVariables"`
	MemorySize           int                         `json:"memorySize"`
	Timeout              int                         `json:"timeout"`
	Description          string                      `json:"description"`
}

type lambdaNodeData struct {
	Kind   string       `json:"kind"`
	Label  string       `json:"label"`
	Config lambdaConfig `json:"config"`
}

type diagramNode struct {
	ID   string         `json:"id"`
	Type string         `json:"type"`
	Data lambdaNodeData `json:"data"`
}

type diagramEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type deploymentSettings struct {
	Region           string `json:"region"`
	ExecutionRoleARN string `json:"executionRoleArn"`
}

type diagram struct {
	Nodes              []diagramNode       `json:"nodes"`
	Edges              []diagramEdge       `json:"edges"`
	DeploymentSettings deploymentSettings  `json:"deploymentSettings"`
	LastSavedAt        string              `json:"lastSavedAt"`
}

type requestPayload struct {
	Diagram diagram `json:"diagram"`
}

type planResource struct {
	ID                       string `json:"id"`
	Type                     string `json:"type"`
	Name                     string `json:"name"`
	Runtime                  string `json:"runtime"`
	MemorySize               int    `json:"memorySize"`
	Timeout                  int    `json:"timeout"`
	EnvironmentVariableCount int    `json:"environmentVariableCount"`
	ConnectionCount          int    `json:"connectionCount"`
}

type planResponse struct {
	Valid     bool           `json:"valid"`
	Errors    []string       `json:"errors"`
	Resources []planResource `json:"resources"`
}

type deployResponse struct {
	Error string          `json:"error,omitempty"`
	Logs  []deploymentLog `json:"logs"`
}

type commandResult struct {
	Code   int
	Stdout string
	Stderr string
}

func main() {
	host := envOrDefault("HOST", "0.0.0.0")
	port := envOrDefault("PORT", "3001")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/api/plan", handlePlan)
	mux.HandleFunc("/api/deploy", handleDeploy)

	address := net.JoinHostPort(host, port)
	log.Printf("Draw-to-Deploy server listening on http://%s", address)

	server := &http.Server{
		Addr:              address,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

func handlePlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	payload, err := decodePayload(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	errors := validateDiagram(payload.Diagram.Nodes)
	response := planResponse{
		Valid:     len(errors) == 0,
		Errors:    errors,
		Resources: buildPlan(payload.Diagram.Nodes, payload.Diagram.Edges),
	}

	status := http.StatusOK
	if len(errors) > 0 {
		status = http.StatusUnprocessableEntity
	}

	writeJSON(w, status, response)
}

func handleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	payload, err := decodePayload(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, deployResponse{
			Error: err.Error(),
			Logs:  []deploymentLog{newLog("error", err.Error())},
		})
		return
	}

	if len(payload.Diagram.Nodes) == 0 {
		writeJSON(w, http.StatusUnprocessableEntity, deployResponse{
			Error: "The diagram does not contain any Lambda nodes.",
			Logs:  []deploymentLog{newLog("error", "Add at least one Lambda node before deploying.")},
		})
		return
	}

	errors := validateDiagram(payload.Diagram.Nodes)
	if len(errors) > 0 {
		logs := make([]deploymentLog, 0, len(errors))
		for _, message := range errors {
			logs = append(logs, newLog("error", message))
		}

		writeJSON(w, http.StatusUnprocessableEntity, deployResponse{
			Error: "The diagram contains invalid Lambda configuration.",
			Logs:  logs,
		})
		return
	}

	if err := ensureCommand("aws"); err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
			Logs:  []deploymentLog{newLog("error", err.Error())},
		})
		return
	}

	if err := ensureCommand("zip"); err != nil {
		writeJSON(w, http.StatusInternalServerError, deployResponse{
			Error: err.Error(),
			Logs:  []deploymentLog{newLog("error", err.Error())},
		})
		return
	}

	logs := []deploymentLog{
		newLog("info", fmt.Sprintf("Validated %d Lambda resource(s).", len(payload.Diagram.Nodes))),
		newLog("info", fmt.Sprintf("Connections are visual-only in this MVP, so %d edge(s) will not affect deployment order.", len(payload.Diagram.Edges))),
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	for _, node := range payload.Diagram.Nodes {
		if err := deployLambda(ctx, node, payload.Diagram.DeploymentSettings, &logs); err != nil {
			message := err.Error()
			logs = append(logs, newLog("error", message))
			writeJSON(w, http.StatusInternalServerError, deployResponse{
				Error: message,
				Logs:  logs,
			})
			return
		}
	}

	writeJSON(w, http.StatusOK, deployResponse{Logs: logs})
}

func decodePayload(r *http.Request) (requestPayload, error) {
	defer r.Body.Close()

	var payload requestPayload
	decoder := json.NewDecoder(r.Body)

	if err := decoder.Decode(&payload); err != nil {
		return requestPayload{}, errors.New("request body must be valid JSON")
	}

	return payload, nil
}

func validateDiagram(nodes []diagramNode) []string {
	var problems []string

	for _, node := range nodes {
		config := node.Data.Config

		if strings.TrimSpace(config.FunctionName) == "" {
			problems = append(problems, fmt.Sprintf("Node %s is missing a function name.", fallbackNodeName(node)))
		}

		if strings.TrimSpace(config.Runtime) == "" {
			problems = append(problems, fmt.Sprintf("Lambda %s is missing a runtime.", fallbackNodeName(node)))
		}

		if strings.TrimSpace(config.Handler) == "" {
			problems = append(problems, fmt.Sprintf("Lambda %s is missing a handler.", fallbackNodeName(node)))
		}

		if strings.TrimSpace(config.Code) == "" {
			problems = append(problems, fmt.Sprintf("Lambda %s is missing inline code.", fallbackNodeName(node)))
		}

		if config.MemorySize < 128 || config.MemorySize > 10240 {
			problems = append(problems, fmt.Sprintf("Lambda %s has an invalid memory size.", fallbackNodeName(node)))
		}

		if config.Timeout < 1 || config.Timeout > 900 {
			problems = append(problems, fmt.Sprintf("Lambda %s has an invalid timeout.", fallbackNodeName(node)))
		}
	}

	return problems
}

func buildPlan(nodes []diagramNode, edges []diagramEdge) []planResource {
	resources := make([]planResource, 0, len(nodes))

	for _, node := range nodes {
		connectionCount := 0
		for _, edge := range edges {
			if edge.Source == node.ID || edge.Target == node.ID {
				connectionCount++
			}
		}

		resources = append(resources, planResource{
			ID:                       node.ID,
			Type:                     "AWS::Lambda::Function",
			Name:                     node.Data.Config.FunctionName,
			Runtime:                  node.Data.Config.Runtime,
			MemorySize:               node.Data.Config.MemorySize,
			Timeout:                  node.Data.Config.Timeout,
			EnvironmentVariableCount: len(normalizeEnvironmentVariables(node.Data.Config.EnvironmentVariables)),
			ConnectionCount:          connectionCount,
		})
	}

	return resources
}

func deployLambda(ctx context.Context, node diagramNode, settings deploymentSettings, logs *[]deploymentLog) error {
	config := node.Data.Config
	region := firstNonEmpty(settings.Region, os.Getenv("AWS_REGION"), os.Getenv("AWS_DEFAULT_REGION"), "us-east-1")
	roleARN := firstNonEmpty(settings.ExecutionRoleARN, os.Getenv("AWS_LAMBDA_EXECUTION_ROLE_ARN"))
	environmentPayload, err := json.Marshal(map[string]map[string]string{
		"Variables": normalizeEnvironmentVariables(config.EnvironmentVariables),
	})
	if err != nil {
		return err
	}

	archivePath, cleanup, err := createLambdaBundle(ctx, config)
	if err != nil {
		return err
	}
	defer cleanup()

	existsResult, err := runCommand(ctx, "", "aws", "lambda", "get-function", "--function-name", config.FunctionName, "--region", region, "--output", "json")
	if err != nil {
		return err
	}

	if existsResult.Code == 0 {
		*logs = append(*logs, newLog("info", fmt.Sprintf("Updating Lambda %s in %s.", config.FunctionName, region)))

		if _, err := runAWSCommand(ctx, "lambda", "update-function-code", "--function-name", config.FunctionName, "--zip-file", "fileb://"+archivePath, "--region", region); err != nil {
			return err
		}

		args := []string{
			"lambda", "update-function-configuration",
			"--function-name", config.FunctionName,
			"--runtime", config.Runtime,
			"--handler", config.Handler,
			"--memory-size", strconv.Itoa(config.MemorySize),
			"--timeout", strconv.Itoa(config.Timeout),
			"--environment", string(environmentPayload),
			"--region", region,
		}
		if description := strings.TrimSpace(config.Description); description != "" {
			args = append(args, "--description", description)
		}

		if _, err := runAWSCommand(ctx, args...); err != nil {
			return err
		}

		*logs = append(*logs, newLog("success", fmt.Sprintf("Updated Lambda %s.", config.FunctionName)))
		return nil
	}

	if !strings.Contains(strings.ToLower(existsResult.Stderr), "resourcenotfoundexception") {
		return fmt.Errorf("unable to determine whether Lambda %s already exists: %s", config.FunctionName, firstNonEmpty(existsResult.Stderr, existsResult.Stdout))
	}

	if strings.TrimSpace(roleARN) == "" {
		return errors.New("an execution role ARN is required to create a new Lambda. Set it in the UI or export AWS_LAMBDA_EXECUTION_ROLE_ARN on the server")
	}

	*logs = append(*logs, newLog("info", fmt.Sprintf("Creating Lambda %s in %s.", config.FunctionName, region)))

	args := []string{
		"lambda", "create-function",
		"--function-name", config.FunctionName,
		"--runtime", config.Runtime,
		"--handler", config.Handler,
		"--role", roleARN,
		"--zip-file", "fileb://"+archivePath,
		"--memory-size", strconv.Itoa(config.MemorySize),
		"--timeout", strconv.Itoa(config.Timeout),
		"--environment", string(environmentPayload),
		"--region", region,
	}
	if description := strings.TrimSpace(config.Description); description != "" {
		args = append(args, "--description", description)
	}

	if _, err := runAWSCommand(ctx, args...); err != nil {
		return err
	}

	*logs = append(*logs, newLog("success", fmt.Sprintf("Created Lambda %s.", config.FunctionName)))
	return nil
}

func createLambdaBundle(ctx context.Context, config lambdaConfig) (string, func(), error) {
	tempDir, err := os.MkdirTemp("", "draw-to-deploy-")
	if err != nil {
		return "", func() {}, err
	}

	cleanup := func() {
		_ = os.RemoveAll(tempDir)
	}

	entryFile := "index.js"
	if strings.HasPrefix(config.Runtime, "python") {
		entryFile = "lambda_function.py"
	}

	entryPath := filepath.Join(tempDir, entryFile)
	if err := os.WriteFile(entryPath, []byte(config.Code), 0o600); err != nil {
		cleanup()
		return "", func() {}, err
	}

	files := []string{entryFile}
	if !strings.HasPrefix(config.Runtime, "python") {
		packageJSONPath := filepath.Join(tempDir, "package.json")
		if err := os.WriteFile(packageJSONPath, []byte("{\n  \"type\": \"commonjs\"\n}\n"), 0o600); err != nil {
			cleanup()
			return "", func() {}, err
		}
		files = append(files, "package.json")
	}

	archivePath := filepath.Join(tempDir, "function.zip")
	args := append([]string{"-q", "-j", archivePath}, files...)
	result, err := runCommand(ctx, tempDir, "zip", args...)
	if err != nil {
		cleanup()
		return "", func() {}, err
	}
	if result.Code != 0 {
		cleanup()
		return "", func() {}, errors.New(firstNonEmpty(result.Stderr, "unable to create the Lambda deployment package"))
	}

	if _, err := os.Stat(archivePath); err != nil {
		cleanup()
		return "", func() {}, err
	}

	return archivePath, cleanup, nil
}

func runAWSCommand(ctx context.Context, args ...string) (commandResult, error) {
	result, err := runCommand(ctx, "", "aws", args...)
	if err != nil {
		return commandResult{}, err
	}
	if result.Code != 0 {
		return commandResult{}, errors.New(firstNonEmpty(result.Stderr, result.Stdout, "AWS CLI command failed"))
	}
	return result, nil
}

func runCommand(ctx context.Context, dir string, name string, args ...string) (commandResult, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	result := commandResult{
		Stdout: strings.TrimSpace(stdout.String()),
		Stderr: strings.TrimSpace(stderr.String()),
	}

	if err == nil {
		result.Code = 0
		return result, nil
	}

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		result.Code = exitErr.ExitCode()
		return result, nil
	}

	return commandResult{}, err
}

func ensureCommand(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("required command %q was not found. Install it and try again", name)
	}
	return nil
}

func normalizeEnvironmentVariables(entries []lambdaEnvironmentVariable) map[string]string {
	values := make(map[string]string)

	for _, entry := range entries {
		key := strings.TrimSpace(entry.Key)
		if key == "" {
			continue
		}

		values[key] = entry.Value
	}

	return values
}

func fallbackNodeName(node diagramNode) string {
	if name := strings.TrimSpace(node.Data.Config.FunctionName); name != "" {
		return name
	}
	if id := strings.TrimSpace(node.ID); id != "" {
		return id
	}
	return "unknown"
}

func newLog(level string, message string) deploymentLog {
	return deploymentLog{
		Level:   level,
		Message: message,
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write JSON error: %v", err)
	}
}

func envOrDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
