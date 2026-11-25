# 03 — Relatório de Incidentes (2ª Entrega — SIF / Frota-Fácil)

**Rama:** `test/andy-web-observability-ai`
**Responsable (Web, Observabilidad e IA):** Andy Merchan
**Fecha:** 2026-11-25

Este documento registra formalmente los incidentes, discrepancias de contrato y defectos arquitectónicos detectados durante la instrumentación y ejecución de los 11 casos de prueba asignados a Andy Merchan en la 2ª Entrega. De acuerdo con las reglas de calidad del proyecto, **no se modificó el código de producción** para ocultarlos, sino que se documentan con su evidencia técnica completa.

---

## Tabla Resumen de Incidentes

| ID Incidente | Caso(s) Asociado(s) | Módulo / Servicio | Severidad | Estado | Resumen |
|---|---|---|---|---|---|
| **INC-ANDY-001** | `TC-AI-001`, `TC-AI-002` | `core-service` / `ai-service` | **Media-Alta** | Abierto (Documentado) | Discrepancia de contrato en `POST /admin/reports/fleet` y endpoint inexistente `POST /reports/fleet` en `ai-service`. |
| **INC-ANDY-002** | `TC-OBS-002`, `TC-TRACK-004` | `tracking-service` (Go) | **Media** | Abierto (Mitigado por reinicio) | Ausencia de reconexión automática AMQP en `RabbitMQPublisher` tras caída de conexión por heartbeat timeout. |
| **INC-ANDY-003** | `TC-ADMIN-001`, `TC-OBS-002` | `admin-app` / `core-service` | **Baja** | Abierto (Alineado en tests) | Discrepancia entre rutas documentadas (`/dashboard`, `/auth/login`) y rutas reales implementadas (`/`, `/admin/auth`). |

---

## Detalle de Incidentes

### INC-ANDY-001 — Discrepancia de contrato en `/admin/reports/fleet` y código huérfano hacia `ai-service`

- **Casos asociados:** `TC-AI-001`, `TC-AI-002`
- **Módulos afectados:** `core-service` (`src/routes/report-router.ts`, `src/use-cases/reports/generate-fleet-report.ts`, `src/services/ai-report-service.ts`) y `ai-service` (`app/routes/report_routes.py`).
- **Severidad propuesta:** **Media-Alta**
- **Pasos de reproducción:**
  1. Inspeccionar `core-service/src/services/ai-report-service.ts` (línea 110): existe la función exportada `requestFleetReportFromAiService` que realiza `POST ${env.AI_REPORT_SERVICE_URL}/reports/fleet`.
  2. Inspeccionar `ai-service/app/routes/report_routes.py`: el router `/reports` únicamente define `@router.post("/routes")`; la ruta `POST /reports/fleet` no existe en `ai-service` (respondería `HTTP 404`).
  3. Ejecutar `POST /admin/reports/fleet` en `core-service` con un `routeId` UUID válido cuya ruta finalizó cuando `ai-service` estaba indisponible (`reportMarkdown = null`).
- **Resultado esperado (según especificación del caso `TC-AI-002`):**
  - Que `POST /admin/reports/fleet` invoque o propague el fallo del servicio de IA devolviendo `HTTP 502/503` cuando la IA no está disponible.
- **Resultado obtenido:**
  - `POST /admin/reports/fleet` (`generateFleetReportUseCase`) **no llama a `ai-service` en tiempo real**; solo consulta `findRouteById(input.routeId)` en PostgreSQL y devuelve `route.reportMarkdown`.
  - La llamada real a `ai-service` (`POST /reports/routes`) ocurre de forma asíncrona y desacoplada (`void generateAndSaveRouteReport(routeId).catch(...)`) dentro de `finishRouteUseCase` (`src/use-cases/routes/finish-route.ts`, línea 62).
  - Cuando `ai-service` falla (devolviendo `502/503`), `finishRouteUseCase` captura el error en segundo plano, deja `reportMarkdown = null` (sin guardar informe parcial) y una consulta posterior a `POST /admin/reports/fleet` devuelve `HTTP 404 ("Relatório da rota ainda não foi gerado")`.
- **Evidencia:** [evidencias/00-reconocimiento.md](../evidencias/00-reconocimiento.md) y [evidencias/TC-AI.txt](../evidencias/TC-AI.txt) (`core-service/tests/andy-ai-reports.spec.ts` y `ai-service/tests/test_reports_ai.py`).

---

### INC-ANDY-002 — Ausencia de reconexión automática a RabbitMQ en `tracking-service`

- **Casos asociados:** `TC-OBS-002`, `TC-TRACK-004`
- **Módulo afectado:** `tracking-service` (`internal/messaging/rabbitmq.go` y `cmd/api/main.go`).
- **Severidad propuesta:** **Media**
- **Pasos de reproducción:**
  1. Levantar `rabbitmq-dev` y `tracking-service-api-1`.
  2. Someter el host a carga intensa de CPU/disco o reiniciar temporalmente la conexión AMQP en RabbitMQ para provocar un `missed heartbeats from client, timeout: 10s` (registrado en `docker logs rabbitmq-dev`: `closing AMQP connection <0.1602.0>`).
  3. Enviar `POST http://localhost:8080/routes/{routeId}/tracking` con coordenadas válidas.
- **Resultado esperado:**
  - Que `RabbitMQPublisher` detecte el cierre del canal/conexión AMQP y restablezca la conexión automáticamente para publicar las coordenadas.
- **Resultado obtenido:**
  - `RabbitMQPublisher` conserva la referencia al `*amqp.Channel` cerrado y falla permanentemente en `p.channel.PublishWithContext(...)`, devolviendo `HTTP 503 Service Unavailable ("failed to publish tracking data")` en el 100% de las solicitudes posteriores hasta reiniciar el contenedor `tracking-service-api-1`.
- **Evidencia:** Traza en `docker logs rabbitmq-dev` (`missed heartbeats from client, timeout: 10s`) y reejecución exitosa tras reinicio en [evidencias/TC-OBS-002.txt](../evidencias/TC-OBS-002.txt).

---

### INC-ANDY-003 — Discrepancia entre rutas documentadas en el plan y rutas reales de autenticación/dashboard

- **Casos asociados:** `TC-ADMIN-001`, `TC-OBS-002`
- **Módulos afectados:** `admin-app` (`src/app/login/form.tsx`, `src/app/page.tsx`) y `core-service` (`src/routes/auth-router.ts`).
- **Severidad propuesta:** **Baja**
- **Pasos de reproducción:**
  1. Revisar `src/routes/auth-router.ts` en `core-service`: el login de administrador es `POST /admin/auth` con `{ cpf, password }` (mientras que `POST /auth` es para conductores con `{ email, password }`; no existe `/auth/login`).
  2. Revisar `src/app/login/form.tsx` en `admin-app`: tras autenticar vía `POST /api/auth/login`, ejecuta `router.push("/")` (la vista raíz `/` renderiza el `<h1 ...>Dashboard</h1>`), no `/dashboard`.
- **Resultado esperado vs. obtenido:**
  - Comportamiento funcional correcto, pero con rutas distintas a las descritas en la hoja de ruta preliminar. Se adaptaron los scripts de Playwright (`e2e/login.spec.ts`) y k6 (`observability/k6/smoke.js` y `load.js`) a las rutas reales del código.
- **Evidencia:** [evidencias/00-reconocimiento.md](../evidencias/00-reconocimiento.md).
