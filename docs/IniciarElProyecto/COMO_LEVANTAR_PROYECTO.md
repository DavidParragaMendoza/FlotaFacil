# Guía Rápida: Cómo Levantar y Apagar el Proyecto SIF (Frota-Fácil)

Esta guía explica paso a paso cómo volver a encender, verificar y apagar todos los servicios del **Sistema Integrado de Frotas (SIF)** en tu laptop Windows cada vez que la reinicies o retomes el proyecto.

---

## 0. Antes de empezar (Requisito indispensable)

1. Abre **Docker Desktop** en Windows y espera unos segundos hasta que el ícono inferior izquierdo esté en verde (**Engine running**).
2. Abre una terminal (PowerShell, CMD o la terminal integrada del editor) ubicada en la carpeta raíz del proyecto:
   ```powershell
   cd C:\Users\ASUS\Desktop\ProjetoIntegrador-Teste\FlotaFacil
   ```

> **Nota para PowerShell en Windows:** Tu Windows tiene bloqueados los scripts `.ps1` sin firma digital (`npm.ps1`), por lo que en PowerShell debes escribir **`npm.cmd`** en lugar de `npm` (por ejemplo: `npm.cmd run dev`). En CMD o Git Bash `npm` funciona directo.

---

## 1. Cómo Levantar el Proyecto en el Día a Día

Como las imágenes Docker, los archivos `.env` y el usuario administrador ya quedaron configurados, **no necesitas volver a construir (`--build`) ni correr el `seed` cada día** (los datos quedan guardados en volúmenes de Docker).

### Paso A — Encender el Backend Principal (`core-service` + PostgreSQL + RabbitMQ + MinIO)
Ejecuta desde la raíz `FlotaFacil`:

```powershell
docker compose -f core-service/compose.dev.yml up -d
```

### Paso B — Encender los Microservicios Auxiliares (Notificaciones, Tracking e IA)
Si vas a probar envío de correos, rastreo GPS o reportes con IA, levántalos también:

```powershell
docker compose -f notification-service/compose.yml up -d
docker compose -f tracking-service/docker-compose.yml up -d
docker compose -f ai-service/compose.yml up -d
```

*(Puedes verificar que todos los contenedores estén arriba ejecutando `docker ps`).*

### Paso C — Encender el Frontend Web Administrativo (`admin-app`)
En tu terminal, entra a `admin-app` e inicia Next.js:

```powershell
cd admin-app
npm.cmd run dev
```

Deja esa terminal abierta mientras trabajas y abre en tu navegador:
👉 **http://localhost:3000**

---

## 2. Accesos, Puertos y Credenciales Locales

| Servicio | URL / Dirección | Usuario / CPF | Contraseña |
|---|---|---|---|
| **Panel Web Admin (`admin-app`)** | http://localhost:3000 | **`000.000.000-00`** | **`123456`** |
| **API Central (`core-service`)** | http://localhost:3333 | — | — |
| **PostgreSQL (`postgres-dev`)** | `localhost:5431` (BD: `sif-dev`) | `postgres-dev` | `postgres-dev` |
| **RabbitMQ (Panel de Colas)** | http://localhost:15672 | `admin` | `admin` |
| **MinIO (Consola de Imágenes S3)** | http://localhost:9001 | `minioadmin` | `minioadmin` |
| **MailHog (Correos de Prueba)** | http://localhost:8025 | *(sin login)* | *(sin login)* |
| **Tracking Service (Go)** | http://localhost:8080 | — | — |
| **AI Report Service (Python)** | http://localhost:8001 | — | — |

---

## 3. Cómo Apagar Todo al Terminar (Para liberar memoria RAM)

1. **Detener `admin-app`**: En la terminal donde corre `npm.cmd run dev`, presiona **`Ctrl + C`**.
2. **Detener los contenedores Docker** (conservando todos tus datos guardados en PostgreSQL):
   ```powershell
   cd C:\Users\ASUS\Desktop\ProjetoIntegrador-Teste\FlotaFacil
   docker compose -f ai-service/compose.yml down
   docker compose -f tracking-service/docker-compose.yml down
   docker compose -f notification-service/compose.yml down
   docker compose -f core-service/compose.dev.yml down
   ```
3. Cierra **Docker Desktop** desde la bandeja del sistema si quieres liberar la memoria de WSL2.

---

## 4. Comandos Útiles de Mantenimiento y Solución de Problemas

### Si actualizas código de GitHub (`git pull`) o cambian dependencias
Reconstruye los contenedores y aplica nuevas migraciones de base de datos:
```powershell
docker compose -f core-service/compose.dev.yml up --build -d
docker compose -f core-service/compose.dev.yml exec app-dev npm run db:migrate
docker compose -f core-service/compose.dev.yml exec app-dev npm run db:seed
```

### Si alguna vez borras los volúmenes (`down -v`) y necesitas recrear la BD desde cero
```powershell
docker compose -f core-service/compose.dev.yml up -d
docker compose -f core-service/compose.dev.yml exec app-dev npm run db:migrate
docker compose -f core-service/compose.dev.yml exec app-dev npm run db:seed
```

### Ver logs en vivo si algún microservicio falla
```powershell
docker compose -f core-service/compose.dev.yml logs -f app-dev
docker compose -f notification-service/compose.yml logs -f notification-service
docker compose -f tracking-service/docker-compose.yml logs -f api
docker compose -f ai-service/compose.yml logs -f ai-report-service
```

### Aviso rojo `1 Issue` (`bis_skin_checked="1"`) en el navegador
- Es causado por extensiones del navegador (como Bitdefender / escudos web / VPN) que modifican el HTML antes de React. No afecta el funcionamiento del sistema; en modo incógnito desaparece.

### Reportes con Inteligencia Artificial (`ai-service`)
- El archivo `ai-service/.env` tiene una clave de marcador de posición para que el contenedor arranque sin errores. Si necesitas generar resúmenes reales con OpenAI al finalizar una ruta, reemplaza `OPENAI_API_KEY=...` en `ai-service/.env` por una API Key válida y reinicia con `docker compose -f ai-service/compose.yml up -d`.

### Ajustes de Infraestructura ya aplicados en tu entorno
- **MinIO (`minio-dev`)**: MinIO retiró sus imágenes gratuitas `minio/minio:latest` y `minio/mc:latest` de Docker Hub; `core-service/compose.dev.yml` ya fue actualizado a la distribución compatible S3 `pgsty/silo:latest` (no lo reviertas al hacer `git checkout`).
- **Variables `.env.dev` de `core-service`**: Se eliminaron los comentarios en línea (`#locationiq`, `#streets`) que traía `.env.example` para evitar fallos de validación Zod al arrancar `core-service`.


