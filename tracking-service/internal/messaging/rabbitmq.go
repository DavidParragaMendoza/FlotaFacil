package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

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

type RabbitMQPublisher struct {
	conn       *amqp.Connection
	channel    *amqp.Channel
	exchange   string
	routingKey string
}

func NewRabbitMQPublisher(cfg RabbitMQConfig) (*RabbitMQPublisher, error) {
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

	return &RabbitMQPublisher{
		conn:       conn,
		channel:    channel,
		exchange:   cfg.Exchange,
		routingKey: cfg.RoutingKey,
	}, nil
}

func (p *RabbitMQPublisher) PublishTracking(ctx context.Context, message handlers.TrackingMessage) error {
	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal tracking message: %w", err)
	}

	err = p.channel.PublishWithContext(
		ctx,
		p.exchange,
		p.routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
		},
	)
	if err != nil {
		return fmt.Errorf("publish tracking message: %w", err)
	}

	return nil
}

func (p *RabbitMQPublisher) Close() error {
	if p == nil {
		return nil
	}

	if err := p.channel.Close(); err != nil {
		_ = p.conn.Close()
		return err
	}

	return p.conn.Close()
}

func amqpURL(cfg RabbitMQConfig) string {
	return (&url.URL{
		Scheme: "amqp",
		User:   url.UserPassword(cfg.User, cfg.Password),
		Host:   fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Path:   "/",
	}).String()
}
