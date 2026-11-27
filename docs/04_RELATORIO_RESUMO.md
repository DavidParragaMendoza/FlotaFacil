# 04 — Relatório Resumo de Testes (2ª Entrega — SIF / Frota-Fácil)

**Rama:** `test/andy-web-observability-ai`
**Responsable (Web, Observabilidad, Tracking e IA):** Andy Merchan
**Fecha:** 2026-11-25

---

## 1. Balance Numérico de Ejecución (Parte de Andy Merchan)

| Indicador | Valor | Detalle |
|---|---|---|
| **Casos asignados** | **11** | `TC-ADMIN-001`, `TC-TRACK-001..004`, `TC-AI-001..002`, `TC-OBS-001..003`, `TC-DOCS` |
| **Casos ejecutados** | **11 (100%)** | Todos los casos fueron instrumentados, ejecutados y respaldados con evidencias |
| **Casos aprobados (`Executado com sucesso`)** | **11 (100%)** | Todos cumplen los criterios de aceptación funcionales y de rendimiento |
| **Casos fallidos (`Falhou`)** | **0 (0%)** | 3 hallazgos arquitectónicos/contratos documentados en `03_RELATORIO_INCIDENTES.md` |

---

## 2. Detalle por Caso de Prueba y Evidencias

| ID Caso | Módulo / Herramienta | Resultado | Métricas / Aserciones Verificadas | Evidencia |
|---|---|---|---|---|
| **TC-ADMIN-001** | `admin-app` (Playwright E2E Chromium) | **Executado com sucesso** | 2/2 escenarios E2E pasados (login negativo con `"Credenciais inválidas"` en `/login` y login positivo con CPF seed `00000000000`, redirección al Dashboard `/`, cookie `token` httpOnly creada y captura full-page). | [evidencias/TC-ADMIN-001/](../evidencias/TC-ADMIN-001/index.html) y [dashboard-authenticated.png](../evidencias/TC-ADMIN-001/dashboard-authenticated.png) |
| **TC-TRACK-001** | `tracking-service` (Go `httptest`) | **Executado com sucesso** | `POST /routes/{routeId}/tracking` con `lat=0, lon=0` -> `HTTP 200`, payload JSON válido hacia exchange `tracking` (`tracking.updated`). | [evidencias/TC-TRACK.txt](../evidencias/TC-TRACK.txt) |
| **TC-TRACK-002** | `tracking-service` (Go `httptest` AVL) | **Executado com sucesso** | 4 combinaciones en límites exactos (`lat ±90`, `lon ±180`) -> `HTTP 200` y preservación exacta de coordenadas en el mock. | [evidencias/TC-TRACK.txt](../evidencias/TC-TRACK.txt) |
| **TC-TRACK-003** | `tracking-service` (Go `httptest` PCE) | **Executado com sucesso** | 7 subcasos fuera de rango (`lat 91/-91`, `lon -181/181`), campos omitidos y JSON malformado -> `HTTP 400` con mensaje específico y 0 publicaciones en mock. | [evidencias/TC-TRACK.txt](../evidencias/TC-TRACK.txt) |
| **TC-TRACK-004** | `tracking-service` (Go `httptest` Mock Error) | **Executado com sucesso** | Falla simulada en `TrackingPublisher` -> `HTTP 503 ("failed to publish tracking data")` sin confirmar publicación. | [evidencias/TC-TRACK.txt](../evidencias/TC-TRACK.txt) |
| **TC-AI-001** | `core-service` (Vitest) + `ai-service` (Pytest) | **Executado com sucesso** | `POST /admin/reports/fleet` con JWT admin y UUID válido -> `HTTP 200` con `routeId` y `markdown_content` no vacío; `POST /reports/routes` con cliente OpenAI simulado -> `HTTP 200`. | [evidencias/TC-AI.txt](../evidencias/TC-AI.txt) |
| **TC-AI-002** | `core-service` (Vitest) + `ai-service` (Pytest) | **Executado com sucesso** | (a) `routeId` no UUID -> `HTTP 400` sin invocar IA. (b) IA simulada devolviendo `503` -> error controlado (`HTTP 502` en `ai-service`), ningún informe parcial persistido en BD. | [evidencias/TC-AI.txt](../evidencias/TC-AI.txt) |
| **TC-OBS-001** | `observability` (Prometheus + PowerShell) | **Executado com sucesso** | `GET :9090/api/v1/targets` reporta `3/3` jobs instrumentados en `UP` (`core-service:3333`, `tracking-service:8080`, `notification-service:3331`) y `3/3` endpoints `/metrics` responden `HTTP 200`. | [evidencias/TC-OBS-001.txt](../evidencias/TC-OBS-001.txt) |
| **TC-OBS-002** | `observability` (k6 Smoke Test) | **Executado com sucesso** | `1 VU` durante `30s`: `74/74` checks exitosos (`100%`), `p(95) = 131.21 ms` (`< 500 ms`), `http_req_failed = 0.00%` (`< 1%`). | [evidencias/TC-OBS-002.txt](../evidencias/TC-OBS-002.txt) y [TC-OBS-002-smoke.json](../evidencias/TC-OBS-002-smoke.json) |
| **TC-OBS-003** | `observability` (k6 Load + Nginx 1 vs. 2 inst.) | **Executado com sucesso** | Corrida A (`1 inst.`): `1,847 reqs`, `p(95) = 22.91 ms`, `0.00%` errores. Corrida B (`2 inst.`): `1,394 reqs`, `p(95) = 330.16 ms`, `0.00%` errores. Cuello de botella documentado. | [evidencias/TC-OBS-003.md](../evidencias/TC-OBS-003.md) |
| **TC-DOCS** | Documentación Académica IFRN | **Executado com sucesso** | Matriz `02_CASOS_DE_TESTE.md` actualizada, incidentes en `03_RELATORIO_INCIDENTES.md` y resumen en `04_RELATORIO_RESUMO.md`. | Este documento |

---

## 3. Cobertura de Código Alcanzada

- **`tracking-service` (Go `go tool cover`):**
  - `internal/server/server.go`: **`100.0%`** (`New`, `healthHandler`, `requestLogger`, `writeJSON`).
  - `internal/handlers/tracking_handler.go`: **`92.6%` – `100.0%`** (`CreateTracking`: `92.6%`, `coordinateValue`: `100.0%`, `validLatitude`: `100.0%`, `validLongitude`: `100.0%`, `validCoordinate`: `100.0%`).
  - Cobertura total sobre `./internal/...` (incluyendo adaptador AMQP real no invocado en unit tests): **`61.3%`**.
- **`ai-service` (Python `pytest --cov=app`):**
  - Cobertura global del microservicio: **`93.0%`** (`184` sentencias, solo `12` no cubiertas; `app/config.py`: `100%`, `app/errors/report_errors.py`: `100%`, `app/schemas/report.py`: `100%`, `app/services/openai_service.py`: `90%`, `app/routes/report_routes.py`: `88%`).
- **`core-service` (Vitest `tests/andy-ai-reports.spec.ts`):**
  - `4/4` tests de integración y casos de uso aprobados (`100%`) cubriendo `POST /admin/reports/fleet`, `generateFleetReportUseCase`, `generateRouteReportUseCase`, `requestRouteReportFromAiService` y `finishRouteUseCase`.
