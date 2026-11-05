package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Frota-Facil/tracking-service/internal/handlers"
)

type fakeTrackingPublisher struct {
	messages []handlers.TrackingMessage
	err      error
}

func (p *fakeTrackingPublisher) PublishTracking(_ context.Context, message handlers.TrackingMessage) error {
	if p.err != nil {
		return p.err
	}

	p.messages = append(p.messages, message)
	return nil
}

func TestHealthHandler(t *testing.T) {
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), &fakeTrackingPublisher{})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("expected valid json response: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}

	if body["service"] != "tracking-service" {
		t.Fatalf("expected service tracking-service, got %q", body["service"])
	}
}

func TestMetricsHandler(t *testing.T) {
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), &fakeTrackingPublisher{})

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if contentType := res.Header().Get("Content-Type"); contentType == "" {
		t.Fatal("expected metrics content type")
	}

	if !bytes.Contains(res.Body.Bytes(), []byte("go_goroutines")) {
		t.Fatal("expected Go runtime metrics in response")
	}
}

func TestCreateTracking(t *testing.T) {
	publisher := &fakeTrackingPublisher{}
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

	createdAt := "2026-07-08T14:30:00Z"
	body := bytes.NewBufferString(`{"latitude":-5.812759,"longitude":-35.211,"capturedAt":"` + createdAt + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/routes/route-123/tracking", body)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if len(publisher.messages) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(publisher.messages))
	}

	message := publisher.messages[0]
	if message.RouteID != "route-123" {
		t.Fatalf("expected route ID route-123, got %q", message.RouteID)
	}

	if message.Latitude != -5.812759 {
		t.Fatalf("expected Latitude -5.812759, got %f", message.Latitude)
	}

	if message.Longitude != -35.211 {
		t.Fatalf("expected Longitude -35.211, got %f", message.Longitude)
	}

	expectedCreatedAt, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		t.Fatalf("expected valid capturedAt fixture: %v", err)
	}

	if !message.CapturedAt.Equal(expectedCreatedAt) {
		t.Fatalf("expected CapturedAt %s, got %s", expectedCreatedAt, message.CapturedAt)
	}
}

func TestCreateTrackingAcceptsLegacyCoordinates(t *testing.T) {
	publisher := &fakeTrackingPublisher{}
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

	createdAt := "2026-07-08T14:30:00Z"
	body := bytes.NewBufferString(`{"xCoordinate":-3.7319,"yCoordinate":-38.5267,"created_at":"` + createdAt + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/routes/route-123/tracking", body)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if len(publisher.messages) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(publisher.messages))
	}

	message := publisher.messages[0]
	if message.Latitude != -3.7319 {
		t.Fatalf("expected Latitude -3.7319, got %f", message.Latitude)
	}

	if message.Longitude != -38.5267 {
		t.Fatalf("expected Longitude -38.5267, got %f", message.Longitude)
	}

	expectedCapturedAt, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		t.Fatalf("expected valid created_at fixture: %v", err)
	}

	if !message.CapturedAt.Equal(expectedCapturedAt) {
		t.Fatalf("expected CapturedAt %s, got %s", expectedCapturedAt, message.CapturedAt)
	}
}
