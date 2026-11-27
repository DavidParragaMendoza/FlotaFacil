# Informe de Diagnóstico — Fase 0 SIF

**Fecha de ejecución:** 2026-11-05  
**Entorno:** Windows PowerShell, Docker Desktop 29.4.0, Node.js v24.11.1  
**Alcance:** T0.1–T0.4, sin modificar código de aplicación.

## T0.1 — Salud de contenedores y acceso administrativo

Se ejecutó `docker compose -f <archivo> up -d` para los cinco archivos indicados:

| Stack | Resultado |
|---|---|
| `core-service/compose.dev.yml` | Iniciado |
| `notification-service/compose.yml` | Iniciado |
| `tracking-service/docker-compose.yml` | Iniciado |
| `ai-service/compose.yml` | Iniciado |
| `observability/docker-compose.yml` | Iniciado |

Evidencia final de `docker ps`:

| Contenedor | Estado |
|---|---|
| `postgres-dev` | Up (healthy) |
| `rabbitmq-dev` | Up (healthy) |
| `minio-dev` | Up (healthy) |
| `core-service-app-dev-1` | Up |
| `notification-service-notification-service-1` | Up |
| `notification-service-mailhog-1` | Up |
| `tracking-service-api-1` | Up |
| `ai-report-service` | Up |
| `sif-prometheus` | Up |
| `sif-grafana` | Up |

La página `http://localhost:3000/login` respondió HTTP 200. La autenticación seed fue validada contra `POST /api/auth/login` con:

```json
{"cpf":"00000000000","senha":"123456"}
```

Resultado: HTTP 200, `{"success":true}`. La interfaz elimina la puntuación del CPF antes de enviar; el intento literal con puntuación respondió HTTP 400, por lo que no se considera fallo de la credencial semilla.

## T0.2 — Línea base de pruebas

Ejecución realizada el 2026-11-05 en Windows PowerShell. Se ejecutó primero `npm.cmd install` en `core-service`; terminó correctamente y dejó 17 vulnerabilidades reportadas por npm audit (7 moderadas, 9 altas y 1 crítica). No se ejecutó `npm audit fix`, porque está fuera del alcance de T0.2.

| Componente | Comando exacto | Resultado | Conteo passed/failed | Tiempo real (pared) |
|---|---|---:|---:|---:|
| core-service | `npm.cmd install` | PASS (rc 0) | — | 76.259 s |
| core-service | `npm.cmd run test` | FAIL (rc 1) | 23 / 1 (24 definidos) | 12.819 s |
| core-service | `npm.cmd run lint` | FAIL (rc 1) | No aplica | 4.778 s |
| tracking-service (contenedor `api`) | `docker compose -f tracking-service/docker-compose.yml exec api go test ./...` | PASS (rc 0) | 4 / 0 | 5.668 s |

Detalles:

- `core-service` test: el único fallo fue `tracks e relatorios > cria track apenas quando a rota existe`, que agotó el timeout de 5 s después de que Mapbox respondiera HTTP 401 (`Not Authorized`). Vitest reportó 23 pruebas pasadas y 1 fallida.
- `core-service` lint: falló porque `biome check` detectó que `biome.json` y archivos del proyecto no están formateados conforme a la configuración; no se aplicaron correcciones.
- `tracking-service`: el contenedor `api` estaba activo y la suite terminó correctamente. Se ejecutaron 4 funciones `Test*` en `internal/server/server_test.go`; los demás paquetes no contenían archivos de pruebas.
- `admin-app`: no se volvió a ejecutar en esta actualización de T0.2; por tanto, no se presenta como evidencia nueva aquí. Los resultados históricos de lint/build que constaban en la versión anterior no fueron revalidados.

## T0.3 — Puertos Prometheus/Grafana

Se corrigió `observability/prometheus/prometheus.yml`:

- `tracking-service`: `host.docker.internal:8080`
- `notification-service`: `host.docker.internal:3331`

Los endpoints `/metrics` de los tres servicios respondieron HTTP 200. La API de Prometheus (`http://localhost:9090/api/v1/targets`) confirmó:

| Job | URL | Salud |
|---|---|---|
| `core-service` | `http://host.docker.internal:3333/metrics` | UP |
| `tracking-service` | `http://host.docker.internal:8080/metrics` | UP |
| `notification-service` | `http://host.docker.internal:3331/metrics` | UP |

Resultado cuantitativo: **3/3 targets UP**.

## T0.4 — Diagnóstico RabbitMQ y brecha DLX

La API de administración de RabbitMQ (`http://localhost:15672/api`, credencial local `admin/admin`) mostró:

- Exchanges de aplicación: `app.events` (topic, durable) y `tracking` (topic, durable).
- Cola `notification.solicitation.created`: durable, `arguments={}`; binding desde `app.events`.
- Cola `tracking.coordinates.updated`: durable, `arguments={}`; binding desde `tracking`, routing key `tracking.updated`.
- No se encontraron colas con sufijo `.dlq`.
- Ninguna de las dos colas declara `x-dead-letter-exchange` (ni otros argumentos DLX).

Esto queda registrado como brecha arquitectónica de línea base para la 1.ª y 2.ª entrega. No se añadieron DLX/DLQ en esta fase.

## Archivos modificados

- `observability/prometheus/prometheus.yml` — corrección de puertos de scraping.
- `FASE0_DIAGNOSTICO.md` — este informe cuantitativo y de evidencia.
