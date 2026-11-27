# TC-OBS-003 — Evaluación Comparativa de Escalabilidad (1 Instancia vs. 2 Instancias)

**Fecha:** 2026-11-25
**Servicio escalado:** `core-service` (`sif-dev:latest`) balanceado mediante Nginx (`observability/docker-compose.scale.yml` + `observability/nginx/nginx.conf`)
**Script de carga:** `observability/k6/load.js` (Etapas: calentamiento `10s -> 5 VUs`, carga sostenida `20s -> 10 VUs`, pico `10s -> 15 VUs`, enfriamiento `5s -> 0 VUs`; Duración total: `45s`)
**Archivos de evidencia asociados:**
- Resumen JSON (1 instancia): `evidencias/TC-OBS-003-1inst.json` (`evidencias/TC-OBS-003-1inst.txt`)
- Resumen JSON (2 instancias): `evidencias/TC-OBS-003-2inst.json` (`evidencias/TC-OBS-003-2inst.txt`)

---

## 1. Tabla Comparativa de Rendimiento y Recursos

| Métrica / Recurso | Corrida A (1 Instancia `core-scale=1`) | Corrida B (2 Instancias `core-scale=2`) | Umbral / SLA | Estado |
|---|---|---|---|---|
| **VUs Máximos (`vus_max`)** | `15 VUs` | `15 VUs` | `15 VUs` (dataset idéntico) | OK |
| **Total Peticiones (`http_reqs`)** | `1,847 reqs` | `1,394 reqs` | — | OK |
| **Throughput (`req/s`)** | `40.64 req/s` (`13.53 iter/s`) | `29.47 req/s` (`9.81 iter/s`) | — | OK |
| **Latencia Media (`avg`)** | `11.23 ms` | `59.95 ms` | — | OK |
| **Latencia Mediana (`med` / `p50`)** | `11.83 ms` | `16.71 ms` | — | OK |
| **Latencia `p(90)`** | `19.42 ms` | `58.63 ms` | — | OK |
| **Latencia `p(95)`** | **`22.91 ms`** | **`330.16 ms`** | **`< 500 ms`** | **CUMPLIDO (`✓`)** |
| **Tasa de Errores (`http_req_failed`)** | **`0.00%`** (`0 / 1,847`) | **`0.00%`** (`0 / 1,394`) | **`< 1.00%`** | **CUMPLIDO (`✓`)** |
| **Checks Exitosos** | `100.00%` (`1,847 / 1,847`) | `100.00%` (`1,394 / 1,394`) | `100%` | **CUMPLIDO (`✓`)** |
| **CPU `core-scale-1`** | `107.03%` | `81.03%` | — | Reparto efectivo |
| **CPU `core-scale-2`** | *(No aplica)* | `84.32%` | — | Reparto efectivo |
| **RAM `core-scale` (por réplica)** | `184.0 MiB` (`4.89%`) | `182.2 MiB` (`#1`) / `207.9 MiB` (`#2`) | Límite WSL2: `3.675 GiB` | OK |
| **CPU / RAM `postgres-dev`** | `101.69%` / `75.22 MiB` | `116.68%` / `89.84 MiB` | — | Incremento por conexiones |
| **CPU / RAM `rabbitmq-dev`** | `48.91%` / `169.6 MiB` | **`220.44%`** / `239.8 MiB` | — | Contención en broker |

---

## 2. Análisis Técnico y Cuello de Botella Identificado

1. **Cumplimiento del SLA y balanceo efectivo:** Ambas corridas completaron el 100% de las validaciones (`0.00%` de errores) y mantuvieron el percentil 95 de latencia por debajo del SLA de `500 ms` (`22.91 ms` con 1 instancia y `330.16 ms` con 2 instancias). Las métricas de `docker stats` confirman que Nginx (`sif-core-lb`) distribuyó la carga equitativamente entre las dos réplicas (`81.03%` de CPU en `core-scale-1` y `84.32%` de CPU en `core-scale-2`, frente a `107.03%` en una única instancia).
2. **Explicación de la diferencia de latencia y cuello de botella real:** Al escalar horizontalmente `core-service` de 1 a 2 réplicas en una misma máquina física con recursos acotados (`7.88 GB` de RAM física total y `3.675 GiB` asignados a WSL2), la latencia `p(95)` subió de `22.91 ms` a `330.16 ms` y el throughput pasó de `40.64 req/s` a `29.47 req/s`. Los datos empíricos de telemetría demuestran que el cuello de botella **no** estuvo en el hashing `bcrypt` del login (que se ejecuta una sola vez en `setup()`) ni en la capa HTTP de Fastify, sino en la **contención de infraestructura compartida (RabbitMQ, PostgreSQL y CPU del host)**:
   - Cada instancia de `core-service` inicializa `rabbitPlugin` (`startRabbitConsumers()`), abriendo canales y consumidores concurrentes contra la única instancia de `rabbitmq-dev`. Al duplicar las réplicas bajo un flujo continuo de eventos `tracking.updated` desde `tracking-service`, el consumo de CPU de `rabbitmq-dev` se cuadruplicó de **`48.91%` a `220.44%`** y el de `postgres-dev` subió de **`101.69%` a `116.68%`** por las escrituras concurrentes de `tracks` y lecturas del pool de conexiones.
   - En un entorno productivo distribuido (nodos separados para aplicación y brokers/BD), el reparto observado en la capa de aplicación (`107%` -> `~82%` por réplica) permitiría escalar linealmente las lecturas; en un único host local, la saturación de CPU de RabbitMQ/PostgreSQL domina el tiempo de espera (`http_req_waiting`).
3. **Restauración del entorno:** Al finalizar la Corrida B, se ejecutó `docker compose -f observability/docker-compose.scale.yml down`, restaurando el entorno a 1 sola instancia activa de `core-service` sin eliminar volúmenes persistentes.
