package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/Frota-Facil/tracking-service/internal/handlers"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Config struct {
	Host string
	Port string
}

func New(cfg Config, logger *slog.Logger, trackingPublisher handlers.TrackingPublisher) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	mux.Handle("GET /metrics", promhttp.Handler())
	mux.HandleFunc("POST /routes/{routeId}/tracking", handlers.CreateTracking(trackingPublisher))

	return &http.Server{
		Addr:              cfg.Host + ":" + cfg.Port,
		Handler:           requestLogger(logger, mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "tracking-service",
	})
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		next.ServeHTTP(w, r)
		logger.Info(
			"request completed",
			"method", r.Method,
			"path", r.URL.Path,
			"duration_ms", time.Since(startedAt).Milliseconds(),
		)
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(value)
}
