package handlers

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"time"
)

type TrackingRequest struct {
	Latitude    *float64  `json:"latitude"`
	Longitude   *float64  `json:"longitude"`
	CapturedAt  time.Time `json:"capturedAt"`
	XCoordinate *float64  `json:"xCoordinate"`
	YCoordinate *float64  `json:"yCoordinate"`
	CreatedAt   time.Time `json:"created_at"`
}

type TrackingMessage struct {
	RouteID    string    `json:"routeId"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	CapturedAt time.Time `json:"capturedAt"`
}

type TrackingPublisher interface {
	PublishTracking(context.Context, TrackingMessage) error
}

func CreateTracking(publisher TrackingPublisher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		routeID := r.PathValue("routeId")
		if routeID == "" {
			http.Error(w, "routeId is required", http.StatusBadRequest)
			return
		}

		var payload TrackingRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		latitude, hasLatitude := coordinateValue(payload.Latitude, payload.XCoordinate)
		if !hasLatitude || !validLatitude(latitude) {
			http.Error(w, "latitude is required and must be between -90 and 90", http.StatusBadRequest)
			return
		}

		longitude, hasLongitude := coordinateValue(payload.Longitude, payload.YCoordinate)
		if !hasLongitude || !validLongitude(longitude) {
			http.Error(w, "longitude is required and must be between -180 and 180", http.StatusBadRequest)
			return
		}

		capturedAt := payload.CapturedAt
		if capturedAt.IsZero() {
			capturedAt = payload.CreatedAt
		}
		if capturedAt.IsZero() {
			capturedAt = time.Now().UTC()
		}

		message := TrackingMessage{
			RouteID:    routeID,
			Latitude:   latitude,
			Longitude:  longitude,
			CapturedAt: capturedAt,
		}

		if err := publisher.PublishTracking(r.Context(), message); err != nil {
			http.Error(w, "failed to publish tracking data", http.StatusServiceUnavailable)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

func coordinateValue(primary *float64, legacy *float64) (float64, bool) {
	if primary != nil {
		return *primary, true
	}

	if legacy != nil {
		return *legacy, true
	}

	return 0, false
}

func validLatitude(value float64) bool {
	return validCoordinate(value) && value >= -90 && value <= 90
}

func validLongitude(value float64) bool {
	return validCoordinate(value) && value >= -180 && value <= 180
}

func validCoordinate(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
