package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
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

// TC-TRACK-001: Publicar coordenadas válidas (lat 0, lon 0 y capturedAt válido)
func TestCreateTracking_TC_TRACK_001_ZeroCoordinates(t *testing.T) {
	publisher := &fakeTrackingPublisher{}
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

	capturedAtStr := "2026-11-24T12:00:00Z"
	body := bytes.NewBufferString(`{"latitude":0,"longitude":0,"capturedAt":"` + capturedAtStr + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/routes/route-tc-001/tracking", body)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("TC-TRACK-001: expected status %d, got %d", http.StatusOK, res.Code)
	}

	if len(publisher.messages) != 1 {
		t.Fatalf("TC-TRACK-001: expected 1 published message, got %d", len(publisher.messages))
	}

	msg := publisher.messages[0]
	if msg.RouteID != "route-tc-001" {
		t.Fatalf("TC-TRACK-001: expected routeId route-tc-001, got %q", msg.RouteID)
	}
	if msg.Latitude != 0 || msg.Longitude != 0 {
		t.Fatalf("TC-TRACK-001: expected (0, 0), got (%v, %v)", msg.Latitude, msg.Longitude)
	}

	expectedTime, err := time.Parse(time.RFC3339, capturedAtStr)
	if err != nil {
		t.Fatalf("TC-TRACK-001: invalid fixture time: %v", err)
	}
	if !msg.CapturedAt.Equal(expectedTime) {
		t.Fatalf("TC-TRACK-001: expected capturedAt %s, got %s", expectedTime, msg.CapturedAt)
	}

	// Verificar serialización JSON que se publica al exchange "tracking" con routing key "tracking.updated"
	rawJSON, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("TC-TRACK-001: failed to marshal message to JSON: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(rawJSON, &decoded); err != nil {
		t.Fatalf("TC-TRACK-001: failed to unmarshal message JSON: %v", err)
	}
	if decoded["routeId"] != "route-tc-001" || decoded["latitude"] != float64(0) || decoded["longitude"] != float64(0) {
		t.Fatalf("TC-TRACK-001: unexpected JSON payload: %s", string(rawJSON))
	}
}

// TC-TRACK-002: Análisis de valores límite (AVL) en coordenadas GPS (-90/90 lat, -180/180 lon)
func TestCreateTracking_TC_TRACK_002_BoundaryValues(t *testing.T) {
	testCases := []struct {
		name    string
		payload string
		wantLat float64
		wantLon float64
	}{
		{
			name:    "min_lat_-90_min_lon_-180",
			payload: `{"latitude":-90,"longitude":-180,"capturedAt":"2026-11-24T12:01:00Z"}`,
			wantLat: -90,
			wantLon: -180,
		},
		{
			name:    "max_lat_90_min_lon_-180",
			payload: `{"latitude":90,"longitude":-180,"capturedAt":"2026-11-24T12:02:00Z"}`,
			wantLat: 90,
			wantLon: -180,
		},
		{
			name:    "min_lat_-90_max_lon_180",
			payload: `{"latitude":-90,"longitude":180,"capturedAt":"2026-11-24T12:03:00Z"}`,
			wantLat: -90,
			wantLon: 180,
		},
		{
			name:    "max_lat_90_max_lon_180",
			payload: `{"latitude":90,"longitude":180,"capturedAt":"2026-11-24T12:04:00Z"}`,
			wantLat: 90,
			wantLon: 180,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			publisher := &fakeTrackingPublisher{}
			srv := New(Config{
				Host: "0.0.0.0",
				Port: "8080",
			}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

			req := httptest.NewRequest(http.MethodPost, "/routes/route-tc-002/tracking", bytes.NewBufferString(tc.payload))
			res := httptest.NewRecorder()

			srv.Handler.ServeHTTP(res, req)

			if res.Code != http.StatusOK {
				t.Fatalf("TC-TRACK-002 (%s): expected status %d, got %d", tc.name, http.StatusOK, res.Code)
			}

			if len(publisher.messages) != 1 {
				t.Fatalf("TC-TRACK-002 (%s): expected 1 message, got %d", tc.name, len(publisher.messages))
			}

			msg := publisher.messages[0]
			if msg.Latitude != tc.wantLat {
				t.Fatalf("TC-TRACK-002 (%s): expected latitude %v, got %v", tc.name, tc.wantLat, msg.Latitude)
			}
			if msg.Longitude != tc.wantLon {
				t.Fatalf("TC-TRACK-002 (%s): expected longitude %v, got %v", tc.name, tc.wantLon, msg.Longitude)
			}
		})
	}
}

// TC-TRACK-003: Coordenadas fuera de rango o ausentes (HTTP 400; el mock no recibe nada)
func TestCreateTracking_TC_TRACK_003_InvalidOrMissingCoordinates(t *testing.T) {
	testCases := []struct {
		name        string
		payload     string
		wantMessage string
	}{
		{
			name:        "latitude_above_max_91",
			payload:     `{"latitude":91,"longitude":0,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "latitude is required and must be between -90 and 90",
		},
		{
			name:        "latitude_below_min_-91",
			payload:     `{"latitude":-91,"longitude":0,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "latitude is required and must be between -90 and 90",
		},
		{
			name:        "longitude_below_min_-181",
			payload:     `{"latitude":0,"longitude":-181,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "longitude is required and must be between -180 and 180",
		},
		{
			name:        "longitude_above_max_181",
			payload:     `{"latitude":0,"longitude":181,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "longitude is required and must be between -180 and 180",
		},
		{
			name:        "missing_latitude",
			payload:     `{"longitude":-35.211,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "latitude is required and must be between -90 and 90",
		},
		{
			name:        "missing_longitude",
			payload:     `{"latitude":-5.812,"capturedAt":"2026-11-24T12:05:00Z"}`,
			wantMessage: "longitude is required and must be between -180 and 180",
		},
		{
			name:        "malformed_json_body",
			payload:     `{"latitude":`,
			wantMessage: "invalid request body",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			publisher := &fakeTrackingPublisher{}
			srv := New(Config{
				Host: "0.0.0.0",
				Port: "8080",
			}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

			req := httptest.NewRequest(http.MethodPost, "/routes/route-tc-003/tracking", bytes.NewBufferString(tc.payload))
			res := httptest.NewRecorder()

			srv.Handler.ServeHTTP(res, req)

			if res.Code != http.StatusBadRequest {
				t.Fatalf("TC-TRACK-003 (%s): expected status %d, got %d", tc.name, http.StatusBadRequest, res.Code)
			}

			gotBody := strings.TrimSpace(res.Body.String())
			if gotBody != tc.wantMessage {
				t.Fatalf("TC-TRACK-003 (%s): expected error message %q, got %q", tc.name, tc.wantMessage, gotBody)
			}

			if len(publisher.messages) != 0 {
				t.Fatalf("TC-TRACK-003 (%s): expected 0 published messages, got %d", tc.name, len(publisher.messages))
			}
		})
	}
}

// TC-TRACK-004: Falla del publisher simulado (HTTP 503 con "failed to publish tracking data")
func TestCreateTracking_TC_TRACK_004_PublisherFailure(t *testing.T) {
	publisher := &fakeTrackingPublisher{
		err: errors.New("amqp channel closed"),
	}
	srv := New(Config{
		Host: "0.0.0.0",
		Port: "8080",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), publisher)

	body := bytes.NewBufferString(`{"latitude":-5.812759,"longitude":-35.211}`)
	req := httptest.NewRequest(http.MethodPost, "/routes/route-tc-004/tracking", body)
	res := httptest.NewRecorder()

	srv.Handler.ServeHTTP(res, req)

	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("TC-TRACK-004: expected status %d, got %d", http.StatusServiceUnavailable, res.Code)
	}

	gotBody := strings.TrimSpace(res.Body.String())
	wantBody := "failed to publish tracking data"
	if gotBody != wantBody {
		t.Fatalf("TC-TRACK-004: expected error message %q, got %q", wantBody, gotBody)
	}

	if len(publisher.messages) != 0 {
		t.Fatalf("TC-TRACK-004: expected 0 confirmed messages, got %d", len(publisher.messages))
	}
}

