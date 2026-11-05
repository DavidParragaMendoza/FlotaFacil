FROM golang:1.23-alpine AS base

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

FROM base AS dev

RUN go install github.com/air-verse/air@v1.61.7

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]

FROM base AS build

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/tracking-service ./cmd/api

FROM alpine:3.20 AS production

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=build /bin/tracking-service /bin/tracking-service

EXPOSE 8080

USER nobody:nobody

CMD ["/bin/tracking-service"]
