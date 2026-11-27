# 03 — Relatório de Incidentes (2ª Entrega — SIF / Frota-Fácil)

**Rama:** `test/andy-web-observability-ai`
**Responsable (Web, Observabilidad e IA):** Andy Merchan
**Última actualización:** 2026-11-27 (Correcciones aplicadas y verificadas por regresión)

Este documento registra los incidentes, discrepancias de contrato y defectos encontrados durante la instrumentación y ejecución de los casos de prueba de la 2ª Entrega, junto con su **posterior corrección y verificación por pruebas de regresión** tras la aprobación explícita del responsable del proyecto.

---

## Tabla Resumen de Incidentes

| ID Incidente | Caso(s) Asociado(s) | Módulo / Servicio | Severidad | Estado | Resumen |
|---|---|---|---|---|---|
| **INC-ANDY-001** | `TC-AI-001`, `TC-AI-002` | `core-service` / `ai-service` | **Media-Alta** | **Resuelto y verificado** | Implementado `POST /reports/fleet` en `ai-service` y manejo tipado `HTTP 502` (JSON/texto) en `core-service/src/services/ai-report-service.ts`. |
| **INC-ANDY-002** | `TC-OBS-002`, `TC-TRACK-004` | `tracking-service` (Go) | **Media** | **Resuelto y verificado** | Implementada reconexión automática AMQP + reintento seguro con mutex en `tracking-service/internal/messaging/rabbitmq.go`. |
| **INC-ANDY-003** | `TC-ADMIN-001`, `TC-OBS-002` | `admin-app` / `core-service` | **Baja** | **Resuelto (Documentación alineada)** | Rutas reales confirmadas (`/`, `/admin/auth`) y alineadas en las suites Playwright y k6 sin alterar producción. |

---

## Detalle de Incidentes y Correcciones Aplicadas

### INC-ANDY-001 — Discrepancia de contrato en reportes de flota (`/reports/fleet`) y manejo de errores `502/503`

- **Casos asociados:** `TC-AI-001`, `TC-AI-002`
- **Módulos afectados:** `core-service` (`src/services/ai-report-service.ts`) y `ai-service` (`app/schemas/report.py`, `app/services/openai_service.py`, `app/routes/report_routes.py`).
- **Severidad:** **Media-Alta**
- **Problema original detectado:**
  1. `core-service/src/services/ai-report-service.ts` exportaba `requestFleetReportFromAiService` apuntando a `POST ${AI_REPORT_SERVICE_URL}/reports/fleet`, pero dicho endpoint **no existía** en `ai-service` (solo existía `POST /reports/routes`).
  2. Tanto `requestFleetReportFromAiService` como `requestRouteReportFromAiService` llamaban a `await response.json()` antes de revisar `response.ok` y lanzaban un `Error` genérico sin `statusCode`, lo que provocaba `SyntaxError` ante respuestas 502/503 en texto plano y `HTTP 500` en lugar de `HTTP 502`.
  3. *(Nota de compatibilidad: `POST /admin/reports/fleet` en `generateFleetReportUseCase` mantiene la lectura de `route.reportMarkdown` de PostgreSQL para preservar compatibilidad con el test existente en `core-service/tests/use-cases.spec.ts`.)*
- **Corrección aplicada:**
  - En `ai-service/app/schemas/report.py`: añadidos los esquemas Pydantic `ReportPeriod` y `GenerateFleetReportInput` alineados al contrato `AiFleetReportPayload` de `core-service`.
  - En `ai-service/app/services/openai_service.py`: implementados `build_fleet_report_prompt` y `generate_fleet_report` reutilizando el mismo manejo de `OpenAIError` (`ReportGenerationError`) y respuesta vacía (`EmptyReportContentError`).
  - En `ai-service/app/routes/report_routes.py`: implementado el endpoint **`POST /reports/fleet`** (`create_fleet_report`), devolviendo `HTTP 200` con `{ markdown_content }` y `HTTP 502` ante fallos o salidas vacías de la IA.
  - En `core-service/src/services/ai-report-service.ts`: añadido `parseResponseBody` (soporte seguro a respuestas de error JSON o texto plano) y `buildAiServiceError` con `statusCode: 502` para errores `5xx` del servicio de IA.
- **Verificación por regresión (sin romper tests del equipo):**
  - `ai-service/tests/test_reports_ai.py` (`pytest -v --cov=app`): **`7/7 passed`** (`93%` cobertura global), incluyendo los 3 nuevos tests de `POST /reports/fleet` (`200`, `422` sin llamar a IA y `502` ante caída de IA).
  - `core-service` (`npx vitest run && npx tsc --noEmit && npx biome check`): **`121 passed` (`0 failed`)** en toda la suite integrada (David + Sara + Andy, incluyendo el nuevo test de regresión en `tests/andy-ai-reports.spec.ts`), `0` errores de TypeScript y `0` errores de Biome.
- **Evidencia:** [evidencias/TC-AI.txt](../evidencias/TC-AI.txt).

---

### INC-ANDY-002 — Ausencia de reconexión automática a RabbitMQ en `tracking-service`

- **Casos asociados:** `TC-OBS-002`, `TC-TRACK-004`
- **Módulo afectado:** `tracking-service` (`internal/messaging/rabbitmq.go`).
- **Severidad:** **Media**
- **Problema original detectado:**
  - `RabbitMQPublisher` abría una única conexión y canal AMQP en el arranque (`main.go`) y nunca detectaba cierres ni reintentaba reconectar. Cuando RabbitMQ cerraba la conexión por *heartbeat timeout* (`missed heartbeats from client, timeout: 10s`), `tracking-service` quedaba permanentemente respondiendo `HTTP 503 ("failed to publish tracking data")` hasta reiniciar el contenedor manualmente.
- **Corrección aplicada:**
  - En `tracking-service/internal/messaging/rabbitmq.go`: refactorizado `RabbitMQPublisher` con protección concurrente (`sync.Mutex`), abstracción interna `amqpSession` (`IsClosed()`, `PublishWithContext()`, `Close()`) y método `reconnectLocked()`.
  - En `PublishTracking`: si la sesión está cerrada o si `PublishWithContext` falla por caída de canal/conexión, el publicador reconecta automáticamente una vez y reintenta la publicación. Si el broker sigue realmente caído, devuelve error para que el handler mantenga el contrato `HTTP 503 ("failed to publish tracking data")` verificado en `TC-TRACK-004`.
- **Verificación por regresión:**
  - Nuevo archivo de pruebas [tracking-service/internal/messaging/rabbitmq_test.go](../tracking-service/internal/messaging/rabbitmq_test.go) con 5 tests unitarios (publicación normal en `tracking`/`tracking.updated`, reconexión automática tras canal cerrado por heartbeat, reconexión y reintento tras fallo mid-flight, error controlado cuando el broker sigue offline y `amqpURL`).
  - Ejecución completa `go test -v -coverpkg=./internal/... ./...`: **100% PASS** (`internal/messaging` + `internal/server`); la cobertura global de `./internal/...` subió de `61.3%` a **`68.1%`** (`reconnectLocked`: `100%`, `PublishTracking`: `82.4%`, `internal/server`: `100%`, `internal/handlers`: `92.6%–100%`).
- **Evidencia:** [evidencias/TC-TRACK.txt](../evidencias/TC-TRACK.txt).

---

### INC-ANDY-003 — Discrepancia entre rutas documentadas en el plan y rutas reales de autenticación/dashboard

- **Casos asociados:** `TC-ADMIN-001`, `TC-OBS-002`
- **Módulos afectados:** `admin-app` (`src/app/login/form.tsx`, `src/app/page.tsx`) y `core-service` (`src/routes/auth-router.ts`).
- **Severidad:** **Baja**
- **Situación y resolución:**
  - No constituye un bug del código fuente: el sistema implementa `POST /admin/auth` en `core-service` y renderiza el Dashboard en `/` en `admin-app` (en lugar de `/auth/login` y `/dashboard` mencionados en el plan preliminar). Se mantuvieron las rutas reales de producción intactas para preservar compatibilidad con todo el equipo y se alinearon la documentación y las suites de Playwright y k6.
- **Evidencia:** [evidencias/00-reconocimiento.md](../evidencias/00-reconocimiento.md).
