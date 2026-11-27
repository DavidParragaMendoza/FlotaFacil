package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Frota-Facil/tracking-service/internal/handlers"
	amqp "github.com/rabbitmq/amqp091-go"
)

type fakeAMQPSession struct {
	closed       bool
	publishErr   error
	published    []publishedRecord
	closeCalled  int
}

type publishedRecord struct {
	exchange   string
	routingKey string
	msg        amqp.Publishing
}

func (f *fakeAMQPSession) PublishWithContext(_ context.Context, exchange, key string, _, _ bool, msg amqp.Publishing) error {
	if f.publishErr != nil {
		return f.publishErr
	}
	f.published = append(f.published, publishedRecord{
		exchange:   exchange,
		routingKey: key,
		msg:        msg,
	})
	return nil
}

func (f *fakeAMQPSession) IsClosed() bool {
	return f.closed
}

func (f *fakeAMQPSession) Close() error {
	f.closed = true
	f.closeCalled++
	return nil
}

func TestAMQPURL(t *testing.T) {
	got := amqpURL(RabbitMQConfig{
		Host:     "rabbitmq-dev",
		Port:     "5672",
		User:     "admin",
		Password: "secret",
	})
	want := "amqp://admin:secret@rabbitmq-dev:5672/"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestPublishTracking_PublishesJSONToConfiguredExchangeAndKey(t *testing.T) {
	session := &fakeAMQPSession{}
	cfg := RabbitMQConfig{
		Exchange:   "tracking",
		RoutingKey: "tracking.updated",
	}

	pub, err := newRabbitMQPublisherWithDial(cfg, func(RabbitMQConfig) (amqpSession, error) {
		return session, nil
	})
	if err != nil {
		t.Fatalf("unexpected error creating publisher: %v", err)
	}
	defer func() { _ = pub.Close() }()

	ts := time.Date(2026, 11, 27, 0, 15, 0, 0, time.UTC)
	err = pub.PublishTracking(context.Background(), handlers.TrackingMessage{
		RouteID:    "route-1",
		Latitude:   -5.812759,
		Longitude:  -35.211,
		CapturedAt: ts,
	})
	if err != nil {
		t.Fatalf("unexpected publish error: %v", err)
	}

	if len(session.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(session.published))
	}
	rec := session.published[0]
	if rec.exchange != "tracking" || rec.routingKey != "tracking.updated" {
		t.Fatalf("unexpected exchange/key: %q / %q", rec.exchange, rec.routingKey)
	}
	if rec.msg.ContentType != "application/json" || rec.msg.DeliveryMode != amqp.Persistent {
		t.Fatalf("unexpected publishing metadata: %+v", rec.msg)
	}

	var decoded handlers.TrackingMessage
	if err := json.Unmarshal(rec.msg.Body, &decoded); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if decoded.RouteID != "route-1" || decoded.Latitude != -5.812759 || decoded.Longitude != -35.211 {
		t.Fatalf("unexpected decoded payload: %+v", decoded)
	}
}

// Regresión INC-ANDY-002: Si RabbitMQ cierra la conexión (heartbeat timeout),
// RabbitMQPublisher detecta la sesión cerrada o el fallo de publicación, reconecta y publica con éxito.
func TestPublishTracking_INC_ANDY_002_AutoReconnectsAfterClosedChannel(t *testing.T) {
	firstSession := &fakeAMQPSession{
		closed:     true, // Simula cierre por heartbeat timeout
		publishErr: errors.New("Exception (504) Reason: \"channel/connection is not open\""),
	}
	secondSession := &fakeAMQPSession{}

	dialCalls := 0
	pub, err := newRabbitMQPublisherWithDial(
		RabbitMQConfig{Exchange: "tracking", RoutingKey: "tracking.updated"},
		func(RabbitMQConfig) (amqpSession, error) {
			dialCalls++
			if dialCalls == 1 {
				return firstSession, nil
			}
			return secondSession, nil
		},
	)
	if err != nil {
		t.Fatalf("unexpected initial dial error: %v", err)
	}

	err = pub.PublishTracking(context.Background(), handlers.TrackingMessage{
		RouteID:    "route-inc-002",
		Latitude:   0,
		Longitude:  0,
		CapturedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("INC-ANDY-002: expected automatic reconnect to succeed, got error: %v", err)
	}
	if dialCalls != 2 {
		t.Fatalf("expected 2 dial calls (initial + reconnect), got %d", dialCalls)
	}
	if len(secondSession.published) != 1 {
		t.Fatalf("expected 1 message on reconnected session, got %d", len(secondSession.published))
	}
}

// Regresión INC-ANDY-002 (caída mid-flight): Si PublishWithContext falla en una sesión
// aparentemente abierta, reconecta y reintenta una vez automáticamente.
func TestPublishTracking_INC_ANDY_002_ReconnectsAndRetriesOnPublishFailure(t *testing.T) {
	firstSession := &fakeAMQPSession{
		closed:     false,
		publishErr: errors.New("connection reset by peer"),
	}
	secondSession := &fakeAMQPSession{}

	dialCalls := 0
	pub, err := newRabbitMQPublisherWithDial(
		RabbitMQConfig{Exchange: "tracking", RoutingKey: "tracking.updated"},
		func(RabbitMQConfig) (amqpSession, error) {
			dialCalls++
			if dialCalls == 1 {
				return firstSession, nil
			}
			return secondSession, nil
		},
	)
	if err != nil {
		t.Fatalf("unexpected initial dial error: %v", err)
	}

	err = pub.PublishTracking(context.Background(), handlers.TrackingMessage{
		RouteID:    "route-midflight",
		Latitude:   -5.8,
		Longitude:  -35.2,
		CapturedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("expected retry after reconnect to succeed, got: %v", err)
	}
	if dialCalls != 2 || len(secondSession.published) != 1 {
		t.Fatalf("expected reconnect (dialCalls=%d) and 1 published msg (got %d)", dialCalls, len(secondSession.published))
	}
}

// Verifica que si RabbitMQ sigue caído al reconectar, PublishTracking retorna error (para HTTP 503).
func TestPublishTracking_ReturnsErrorWhenReconnectFails(t *testing.T) {
	firstSession := &fakeAMQPSession{
		publishErr: errors.New("channel closed"),
	}

	dialCalls := 0
	pub, err := newRabbitMQPublisherWithDial(
		RabbitMQConfig{Exchange: "tracking", RoutingKey: "tracking.updated"},
		func(RabbitMQConfig) (amqpSession, error) {
			dialCalls++
			if dialCalls == 1 {
				return firstSession, nil
			}
			return nil, errors.New("dial tcp: connection refused")
		},
	)
	if err != nil {
		t.Fatalf("unexpected initial dial error: %v", err)
	}

	err = pub.PublishTracking(context.Background(), handlers.TrackingMessage{
		RouteID:    "route-offline",
		Latitude:   10,
		Longitude:  20,
		CapturedAt: time.Now().UTC(),
	})
	if err == nil {
		t.Fatal("expected error when broker stays unreachable during reconnect")
	}
}
