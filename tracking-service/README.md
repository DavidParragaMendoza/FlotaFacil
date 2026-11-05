# Tracking Service

Servico Go dockerizado para desenvolvimento sem instalar Go na maquina local.

## Requisitos

- Docker
- Docker Compose
- Make opcional

## Setup

Crie o arquivo de ambiente e construa a imagem:

```sh
cp .env.example .env
docker compose build
```

Ou, se tiver `make`:

```sh
make setup
```

## Rodando em desenvolvimento

```sh
docker compose up
```

Ou:

```sh
make up
```

A API fica disponivel em:

```text
http://localhost:8080/health
```

As metricas para coleta pelo Prometheus ficam disponiveis em:

```text
http://localhost:8080/metrics
```

O container de desenvolvimento usa Air para recompilar a aplicacao automaticamente quando arquivos Go mudam.

## RabbitMQ

Ao receber coordenadas em `POST /routes/{routeId}/tracking`, o servico declara a exchange topic configurada em `RABBITMQ_TRACKING_EXCHANGE` e publica uma mensagem JSON nela usando a routing key configurada em `RABBITMQ_TRACKING_ROUTING_KEY`.

Payload recomendado:

```json
{
  "latitude": -5.812759,
  "longitude": -35.211,
  "capturedAt": "2026-07-08T15:00:00.000Z"
}
```

Por compatibilidade, o endpoint tambem aceita `xCoordinate`, `yCoordinate` e `created_at`, mas a mensagem publicada usa `latitude`, `longitude` e `capturedAt`.

Variaveis de ambiente:

```env
RABBITMQ_HOST=host.docker.internal
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin
RABBITMQ_TRACKING_EXCHANGE=tracking
RABBITMQ_TRACKING_ROUTING_KEY=tracking.updated
```

O tracking-service nao cria fila nem binding; o servico consumidor deve garantir a fila e o binding para a exchange `tracking` com a routing key `tracking.updated`. Se a API estiver rodando pelo `docker compose` deste projeto e o RabbitMQ estiver exposto na maquina host, use `host.docker.internal`. Se voce rodar a API fora do Docker, use `localhost`. Se o RabbitMQ estiver em outro servico na mesma rede Docker, use o nome desse servico em `RABBITMQ_HOST`.

## Testes

```sh
docker compose run --rm api go test ./...
```

Ou:

```sh
make test
```

## Build de producao

```sh
docker build --target production -t tracking-service:local .
```

Ou:

```sh
make build-prod
```

Se sua maquina tiver apenas o binario legado, troque `docker compose` por `docker-compose`. Os comandos do `Makefile` detectam isso automaticamente.
