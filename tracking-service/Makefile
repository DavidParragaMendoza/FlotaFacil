COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose")

.PHONY: setup up down logs restart test shell build-prod

setup:
	cp -n .env.example .env
	$(COMPOSE) build

up:
	$(COMPOSE) up

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f api

restart:
	$(COMPOSE) restart api

test:
	$(COMPOSE) run --rm api go test ./...

shell:
	$(COMPOSE) run --rm api sh

build-prod:
	docker build --target production -t tracking-service:local .
