package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sync"

	"github.com/Frota-Facil/tracking-service/internal/handlers"
	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMQConfig struct {
	Host       string
	Port       string
	User       string
	Password   string
	Exchange   string
	RoutingKey string
}

type amqpSession interface {
	PublishWithContext(ctx context.Context, exchange, key string, mandatory, immediate bool, msg amqp.Publishing) error
	IsClosed() bool
	Close() error
}

type rabbitSession struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

func (s *rabbitSession) PublishWithContext(ctx context.Context, exchange, key string, mandatory, immediate bool, msg amqp.Publishing) error {
	return s.channel.PublishWithContext(ctx, exchange, key, mandatory, immediate, msg)
}

func (s *rabbitSession) IsClosed() bool {
	if s == nil || s.conn == nil || s.channel == nil {
		return true
	}
	return s.conn.IsClosed() || s.channel.IsClosed()
}

func (s *rabbitSession) Close() error {
	if s == nil {
		return nil
	}

	var chErr error
	if s.channel != nil && !s.channel.IsClosed() {
		chErr = s.channel.Close()
	}

	var connErr error
	if s.conn != nil && !s.conn.IsClosed() {
		connErr = s.conn.Close()
	}

	if chErr != nil {
		return chErr
	}
	return connErr
}

type dialFunc func(RabbitMQConfig) (amqpSession, error)

type RabbitMQPublisher struct {
	mu      sync.Mutex
	cfg     RabbitMQConfig
	dial    dialFunc
	session amqpSession
}

func dialRabbitMQ(cfg RabbitMQConfig) (amqpSession, error) {
	conn, err := amqp.Dial(amqpURL(cfg))
	if err != nil {
		return nil, fmt.Errorf("connect to rabbitmq: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("open rabbitmq channel: %w", err)
	}

	err = channel.ExchangeDeclare(
		cfg.Exchange,
		"topic",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		_ = channel.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("declare rabbitmq exchange %q: %w", cfg.Exchange, err)
	}

	return &rabbitSession{
		conn:    conn,
		channel: channel,
	}, nil
}

func NewRabbitMQPublisher(cfg RabbitMQConfig) (*RabbitMQPublisher, error) {
	return newRabbitMQPublisherWithDial(cfg, dialRabbitMQ)
}

func newRabbitMQPublisherWithDial(cfg RabbitMQConfig, dial dialFunc) (*RabbitMQPublisher, error) {
	session, err := dial(cfg)
	if err != nil {
		return nil, err
	}

	return &RabbitMQPublisher{
		cfg:     cfg,
		dial:    dial,
		session: session,
	}, nil
}

func (p *RabbitMQPublisher) reconnectLocked() error {
	if p.session != nil {
		_ = p.session.Close()
		p.session = nil
	}

	session, err := p.dial(p.cfg)
	if err != nil {
		return err
	}

	p.session = session
	return nil
}

func (p *RabbitMQPublisher) PublishTracking(ctx context.Context, message handlers.TrackingMessage) error {
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal tracking message: %w", err)
	}

	publishing := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.session == nil || p.session.IsClosed() {
		if err := p.reconnectLocked(); err != nil {
			return fmt.Errorf("reconnect to rabbitmq: %w", err)
		}
	}

	err = p.session.PublishWithContext(
		ctx,
		p.cfg.Exchange,
		p.cfg.RoutingKey,
		false,
		false,
		publishing,
	)
	if err == nil {
		return nil
	}

	// INC-ANDY-002: Ante caída de conexión/canal (ej. heartbeat timeout), reconectar y reintentar una vez
	if reconnErr := p.reconnectLocked(); reconnErr != nil {
		return fmt.Errorf("publish tracking message: %w (reconnect failed: %v)", err, reconnErr)
	}

	if retryErr := p.session.PublishWithContext(
		ctx,
		p.cfg.Exchange,
		p.cfg.RoutingKey,
		false,
		false,
		publishing,
	); retryErr != nil {
		return fmt.Errorf("publish tracking message after reconnect: %w", retryErr)
	}

	return nil
}

func (p *RabbitMQPublisher) Close() error {
	if p == nil {
		return nil
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.session == nil {
		return nil
	}

	err := p.session.Close()
	p.session = nil
	return err
}

func amqpURL(cfg RabbitMQConfig) string {
	return (&url.URL{
		Scheme: "amqp",
		User:   url.UserPassword(cfg.User, cfg.Password),
		Host:   fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Path:   "/",
	}).String()
}
