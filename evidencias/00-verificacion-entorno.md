# Informe de Verificación de Prerrequisitos (T0 — Parte A)

**Fecha:** 2026-11-24
**Responsable:** Andy Merchan (`test/andy-web-observability-ai`)
**Sistema Operativo:** Windows 10/11 (`amd64`)

## 1. Tabla de Auditoría de Herramientas

| # | Elemento | Estado | Versión Encontrada | Acción Necesaria / Notas |
|---|---|---|---|---|
| 1 | Git | OK | `git version 2.45.1.windows.1` | Ninguna |
| 2 | Identidad de Git | OK | `Andy Merchan` / `andypaulmerchanperez@gmail.com` | Ninguna |
| 3 | Repositorio Local | OK | Monorepo `FlotaFacil` clonado (`origin/main`) | Rama `test/andy-web-observability-ai` creada desde `main` |
| 4 | Docker & Docker Compose | OK | `Docker version 29.9.2, build a82e528` / `Docker Compose version v5.6.1` | Ninguna |
| 5 | Docker Engine en marcha | OK | `29.9.2 (Docker Desktop)` — Engine running | Ninguna |
| 6 | Node.js & npm | OK | `v26.13.0` / `npm 11.20.0` (`npm.cmd`) | Compatible con `core-service`, `admin-app` y `notification-service` |
| 7 | Go | OK | `go version go1.27.4 windows/amd64` | Compatible con `go 1.23` requerido en `tracking-service/go.mod` |
| 8 | Python & pip | OK | `Python 3.12.10` / `pip 25.0.1` | Coincide con `FROM python:3.12-slim` en `ai-service/Dockerfile` |
| 9 | k6 | OK | `k6.exe v2.4.0 (go1.26.11, windows/amd64)` | Ninguna |
| 10 | Puertos (`3000, 3001, 3331, 3333, 8001, 8080, 9090, 15672`) | OK | Libres antes de levantar los contenedores | Ninguna |
| 11 | Espacio en disco y RAM | OK (con precaución) | Disco C: ~40.3 GB libres; RAM física total: 7,885 MB | Gestionar contenedores con cuidado durante pruebas de carga (T6/T7) |

## 2. Resumen de `docker system df` inicial

```text
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         3         2.24GB    671.7MB (29%)
Containers      3         1         131.1kB   90.11kB (68%)
Local Volumes   2         2         1.572GB   0B (0%)
Build Cache     38        0         2.341GB   1.213GB
```
