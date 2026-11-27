# Reconocimiento Arquitectónico y Rutas Reales (T1)

**Fecha:** 2026-11-24
**Rama:** `test/andy-web-observability-ai`

## 1. `tracking-service` (`POST /routes/{routeId}/tracking`)
- **Ubicación y rutas:** En `tracking-service/internal/server/server.go`, el servidor HTTP (`net/http.ServeMux`) registra `GET /health`, `GET /metrics` (`promhttp.Handler()`) y `POST /routes/{routeId}/tracking` delegado a `handlers.CreateTracking(trackingPublisher)` (`internal/handlers/tracking_handler.go`).
- **Validación y payload:** `CreateTracking` decodifica `TrackingRequest` (`latitude`/`xCoordinate`, `longitude`/`yCoordinate`, `capturedAt`/`created_at`), valida que la latitud esté en `[-90, 90]` (`"latitude is required and must be between -90 and 90"`) y la longitud en `[-180, 180]` (`"longitude is required and must be between -180 and 180"`), devolviendo `HTTP 400 Bad Request` si falla.
- **Publicación en RabbitMQ y simulación (Mock):** `TrackingPublisher` ya está definido como una **interfaz** (`PublishTracking(context.Context, TrackingMessage) error`), inyectada en `server.New(cfg, logger, trackingPublisher)`. La implementación real (`internal/messaging/rabbitmq.go`) serializa `TrackingMessage` a JSON y lo publica en el exchange `tracking` (tipo `topic`) con routing key `tracking.updated`. Si `PublishTracking` retorna error, el handler responde `HTTP 503 Service Unavailable` con `"failed to publish tracking data"`. No se requiere refactorizar código de producción para inyectar un mock en `internal/server/server_test.go`.

## 2. Reportes con IA (`POST /admin/reports/fleet` en `core-service` y `ai-service`)
- **Ubicación del endpoint:** `POST /admin/reports/fleet` vive en **`core-service`** (`core-service/src/routes/report-router.ts`), protegido por `verifyJwt` y `authorize([USER_ROLES[1]])` (rol `ADMIN`), y valida el body con `generateFleetReportSchema` (`{ routeId: z.uuid() }`).
- **Comportamiento real en `core-service`:** El handler invoca `generateFleetReportUseCase` (`src/use-cases/reports/generate-fleet-report.ts`), el cual consulta `findRouteById(input.routeId)` en PostgreSQL: si la ruta no existe lanza `RouteNotFoundError` (`HTTP 404`) y si `route.reportMarkdown` es nulo lanza `RouteReportNotFoundError` (`HTTP 404`); si existe, devuelve `HTTP 200` con `{ routeId, markdown_content }`.
- **Interacción real con `ai-service` y discrepancia detectada:** La llamada HTTP al microservicio de IA (`src/services/ai-report-service.ts`) ocurre al **finalizar una ruta** (`src/use-cases/routes/finish-route.ts` -> `generateRouteReportUseCase`), que hace `POST ${AI_REPORT_SERVICE_URL}/reports/routes` y guarda el markdown resultante con `updateRouteById(routeId, { reportMarkdown })`. Además, existe `requestFleetReportFromAiService` apuntando a `POST /reports/fleet`, pero ese endpoint **no está implementado** en `ai-service` (que en `app/routes/report_routes.py` solo expone `POST /reports/routes` y mapea `OpenAIError` / `ReportGenerationError` a `HTTP 502`).
- **Estrategia de simulación:**
  1. En `core-service` (Vitest + `app.inject()`): simular el repositorio de rutas y `global.fetch` (cliente hacia `ai-service`) para probar `POST /admin/reports/fleet` (`TC-AI-001`, `TC-AI-002a`) y el flujo de generación con IA ante respuesta `503` sin guardar reporte parcial (`TC-AI-002b`).
  2. En `ai-service` (`pytest` + `fastapi.testclient.TestClient`): simular el cliente OpenAI (`app.services.openai_service.client.responses.create`) para verificar que `POST /reports/routes` devuelve `200` con markdown válido y `502` cuando el proveedor de IA falla, sin consumir cuota real.

## 3. Selectores reales del Login en `admin-app` (`/login`)
- **Componente:** `admin-app/src/app/login/form.tsx` (renderizado en `/login` por `src/app/login/page.tsx`).
- **Selectores del formulario:**
  - Campo CPF: `<input placeholder="000.000.000-00" autoComplete="username" inputMode="numeric" maxLength={14} required />` (asociado al `<label>` con texto `"CPF"`). Aplica máscara automática `formatCpf` (`000.000.000-00`) al escribir dígitos y envía solo dígitos (`onlyDigits(cpf)`) a `POST /api/auth/login`.
  - Campo Contraseña: `<input placeholder="Digite sua senha" autoComplete="current-password" type="password" minLength={5} required />` (asociado al `<label>` con texto `"Senha"`).
  - Botón de envío: `<button type="submit">Entrar</button>` (cambia a `"Entrando..."` mientras `isSubmitting` es `true`).
- **Flujo de autenticación y redirección:** `POST /api/auth/login` (`src/app/api/auth/login/route.ts`) llama a `POST ${CORE_API_URL}/admin/auth` con `{ cpf, password }`, guarda el JWT en la cookie `token` (`httpOnly: true, path: "/"`) y el cliente ejecuta `router.push("/")` (la vista raíz `/` actúa como Dashboard administrativo). Ante credenciales inválidas (`HTTP 401`), muestra un bloque de error con el texto `"Credenciais inválidas"` y permanece en `/login`.

## 4. Documentación de Pruebas (`02`, `03` y `04`)
- **`02_CASOS_DE_TESTE.md`:** Localizado en `docs/01_PRIMEIRA_ENTREGA/02_CASOS_DE_TESTE.md` (también existe versión en portugués `02_CASOS_DE_TESTE_PT.md`). Contiene los 10 casos técnicos de Andy en las líneas 15 y 39–51.
- **`03_RELATORIO_INCIDENTES.md`:** No existía en el repositorio; creado en `docs/03_RELATORIO_INCIDENTES.md`.
- **`04_RELATORIO_RESUMO.md`:** No existía en el repositorio; creado en `docs/04_RELATORIO_RESUMO.md`.
