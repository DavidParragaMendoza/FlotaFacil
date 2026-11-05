package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Frota-Facil/tracking-service/internal/messaging"
	"github.com/Frota-Facil/tracking-service/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg := server.Config{
		Host: env("APP_HOST", "0.0.0.0"),
		Port: env("APP_PORT", "8080"),
	}

	trackingPublisher, err := messaging.NewRabbitMQPublisher(messaging.RabbitMQConfig{
		Host:       env("RABBITMQ_HOST", "localhost"),
		Port:       env("RABBITMQ_PORT", "5672"),
		User:       env("RABBITMQ_USER", "admin"),
		Password:   env("RABBITMQ_PASSWORD", "admin"),
		Exchange:   env("RABBITMQ_TRACKING_EXCHANGE", "tracking"),
		RoutingKey: env("RABBITMQ_TRACKING_ROUTING_KEY", "tracking.updated"),
	})
	if err != nil {
		logger.Error("rabbitmq setup failed", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := trackingPublisher.Close(); err != nil {
			logger.Error("rabbitmq close failed", "error", err)
		}
	}()

	srv := server.New(cfg, logger, trackingPublisher)

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting server", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		logger.Info("shutdown signal received", "signal", sig.String())
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("server shutdown failed", "error", err)
		os.Exit(1)
	}

	logger.Info("server stopped")
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}
