<div align="center">

<!-- Header Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F172A,45:1D4ED8,100:10B981&height=230&section=header&text=FlotaFacil%20%E2%80%94%20SIF&fontSize=54&fontColor=FFFFFF&fontAlignY=38&desc=Sistema%20Integrado%20de%20Frotas%20%7C%20Arquitectura%20de%20Microservicios%20y%20Calidad%20de%20Software&descSize=16&descAlignY=63&animation=fadeIn" width="100%" alt="FlotaFacil — SIF Banner" />

<br />

<!-- Language Switcher -->
<p>
  <img src="https://img.shields.io/badge/Idioma-Espa%C3%B1ol_(Actual)-10B981?style=for-the-badge" alt="Español Actual" />
  <a href="./README.pt-BR.md">
    <img src="https://img.shields.io/badge/Mudar_para-Portugu%C3%AAs_(BR)-1E293B?style=for-the-badge&logo=googletranslate&logoColor=white" alt="Ver en Português" />
  </a>
</p>

<!-- Navigation Action Buttons -->
<a href="#-arquitectura-del-sistema">
  <img src="https://img.shields.io/badge/Arquitectura-Microservicios-1D4ED8?style=for-the-badge&logo=diagramsdotnet&logoColor=white" alt="Arquitectura" />
</a>
<a href="#-servicios-y-puertos">
  <img src="https://img.shields.io/badge/Servicios-6_M%C3%B3dulos-0E7490?style=for-the-badge&logo=docker&logoColor=white" alt="Servicios" />
</a>
<a href="#-inicio-r%C3%A1pido">
  <img src="https://img.shields.io/badge/Inicio_R%C3%A1pido-Docker_%26_Local-10B981?style=for-the-badge&logo=rocket&logoColor=white" alt="Inicio Rápido" />
</a>
<a href="#-calidad-pruebas-y-m%C3%A9tricas">
  <img src="https://img.shields.io/badge/Pruebas_%26_QA-98.92%25_Mutaci%C3%B3n-7C3AED?style=for-the-badge&logo=vitest&logoColor=white" alt="Calidad y Pruebas" />
</a>
<a href="./docs/README.md">
  <img src="https://img.shields.io/badge/Documentaci%C3%B3n-Centro_Unificado-D97706?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentación" />
</a>
<a href="#-equipos-y-cr%C3%A9ditos">
  <img src="https://img.shields.io/badge/Equipos-IFRN-0F172A?style=for-the-badge&logo=github&logoColor=white" alt="Equipos" />
</a>

<br /><br />

<!-- Quality & Status Badges -->
<img src="https://img.shields.io/badge/Core_Vitest-121_passed_%7C_21_skipped-22C55E?style=flat-square&logo=vitest&logoColor=white" alt="Core Tests" />
<img src="https://img.shields.io/badge/StrykerJS_Mutation-98.92%25_(183%2F185)-8B5CF6?style=flat-square&logo=stryker&logoColor=white" alt="Stryker Mutation Score" />
<img src="https://img.shields.io/badge/V8_Target_Coverage-100%25_(15%2F15_m%C3%B3dulos)-10B981?style=flat-square" alt="V8 Target Coverage" />
<img src="https://img.shields.io/badge/AI_Service_Pytest-7%2F7_(93%25_cov)-3B82F6?style=flat-square&logo=pytest&logoColor=white" alt="AI Service Pytest" />
<img src="https://img.shields.io/badge/Tracking_Go_Test-100%25_PASS_(68.1%25_cov)-06B6D4?style=flat-square&logo=go&logoColor=white" alt="Tracking Go Test" />
<img src="https://img.shields.io/badge/Admin_E2E-Playwright_PASS-16A34A?style=flat-square&logo=playwright&logoColor=white" alt="Playwright E2E" />
<img src="https://img.shields.io/badge/k6_Smoke_p95-131.21_ms_(0%25_err)-F59E0B?style=flat-square&logo=k6&logoColor=white" alt="k6 Smoke" />

<br />

<!-- Tech Stack Badges -->
<img src="https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify" />
<img src="https://img.shields.io/badge/TypeScript-5%2F6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/Expo_%2F_React_Native-54-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
<img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" />
<img src="https://img.shields.io/badge/Python-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
<img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
<img src="https://img.shields.io/badge/RabbitMQ-AMQP-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
<img src="https://img.shields.io/badge/Prometheus_%26_Grafana-Observability-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Observability" />

</div>

---

## 🚛 Sobre el Proyecto

**FlotaFacil — SIF (Sistema Integrado de Frotas)** es una plataforma distribuida diseñada para la **gestión digital de flotas municipales**, desarrollada en el contexto del Proyecto Integrador del **IFRN (Campus Pau dos Ferros)**.

El sistema digitaliza el ciclo completo de operación vehicular:

- 🔐 **Autenticación y RBAC:** acceso diferenciado para administradores (CPF + contraseña) y conductores (email + contraseña) mediante JWT.
- 🚗 **Gestión de Flota:** alta, edición, baja, control de disponibilidad por agenda y unicidad de placas.
- 📅 **Solicitudes y Aprobaciones:** creación de reservas con bloqueo anti-conflicto horario (vehículo y conductor), aprobación/rechazo administrativo y auditoría completa.
- 📍 **Rastreo GPS en Tiempo Real:** ingesta de coordenadas en Go publicada vía RabbitMQ, persistencia de rutas/tracks y mapas estáticos en almacenamiento S3/MinIO.
- 🤖 **Reportes Analíticos con IA:** generación automatizada de resúmenes ejecutivos de rutas y flota mediante FastAPI + OpenAI.
- 🔔 **Notificaciones y Observabilidad:** alertas por correo/push y monitoreo en vivo con métricas Prometheus, dashboards Grafana y pruebas de carga k6.

---

## 🏛️ Arquitectura del Sistema

```mermaid
flowchart TB
    subgraph Clients["💻 Aplicaciones Cliente"]
        ADMIN["🖥️ Admin App<br/>Next.js 16 (:3000)"]
        MOBILE["📱 App Client<br/>Expo / React Native"]
    end

    subgraph Services["⚙️ Microservicios"]
        CORE["🧠 Core Service<br/>Fastify 5 + Drizzle (:3333)"]
        TRACK["📍 Tracking Service<br/>Go HTTP API (:8080)"]
        AI["🤖 AI Service<br/>Python FastAPI (:8001)"]
        NOTIF["🔔 Notification Service<br/>Fastify + Nodemailer (:3331)"]
    end

    subgraph Infra["🗄️ Infraestructura & Mensajería"]
        PG[("🐘 PostgreSQL 16<br/>(:5431 / :5432)")]
        RMQ(("🐇 RabbitMQ<br/>(:5672 / :15672)"))
        S3[("🪣 MinIO / S3<br/>(:9000 / :9001)")]
        MAIL["✉️ MailHog<br/>(:8025)"]
    end

    subgraph Obs["📈 Observabilidad"]
        PROM["🔥 Prometheus (:9090)"]
        GRAF["📊 Grafana (:3001)"]
    end

    ADMIN -->|"REST + JWT"| CORE
    MOBILE -->|"REST + JWT"| CORE
    MOBILE -->|"POST /routes/:id/tracking"| TRACK

    CORE --> PG
    CORE --> S3
    CORE <-->|"REST /reports/*"| AI
    CORE -->|"app.events"| RMQ
    TRACK -->|"tracking.updated"| RMQ
    RMQ --> CORE
    RMQ --> NOTIF
    NOTIF --> MAIL

    PROM -.->|"/metrics"| CORE
    PROM -.->|"/metrics"| TRACK
    PROM -.->|"/metrics"| NOTIF
    GRAF --> PROM
```

---

## 🧩 Servicios y Puertos

| Servicio | Tecnología | Puerto Local | Responsabilidad | Documentación |
|---|---|---|---|---|
| **[`core-service`](./core-service/)** | Node.js 22, Fastify 5, Drizzle, PostgreSQL, Zod, Biome | `:3333` | API central: auth, RBAC, usuarios, vehículos, solicitudes, rutas, tracks, auditoría y reportes | [README](./core-service/README.md) |
| **[`admin-app`](./admin-app/)** | Next.js 16, React 19, Tailwind CSS 4, Playwright | `:3000` | Panel web administrativo para gestores de flota | [README](./admin-app/README.md) |
| **[`App-client`](./App-client/)** | Expo 54, React Native 0.81, TypeScript, Expo Router | Expo | App móvil para conductores (solicitudes, viajes y GPS en segundo plano) | [README](./App-client/README.md) |
| **[`tracking-service`](./tracking-service/)** | Go, `net/http`, AMQP (reconexión automática) | `:8080` | Ingesta de coordenadas GPS y publicación en RabbitMQ (`tracking.updated`) | [README](./tracking-service/README.md) |
| **[`ai-service`](./ai-service/)** | Python, FastAPI, Pydantic, OpenAI API, Pytest | `:8001` | Generación de reportes analíticos de rutas (`/reports/routes`) y flota (`/reports/fleet`) | [README](./ai-service/README.md) |
| **[`notification-service`](./notification-service/)** | Node.js, Fastify 5, `amqplib`, Nodemailer | `:3331` | Consumo de eventos de solicitudes y envío de notificaciones | [`package.json`](./notification-service/package.json) |
| **[`observability`](./observability/)** | Prometheus, Grafana, Nginx, k6 | `:9090` / `:3001` | Recolección de métricas, dashboards SIF y pruebas de carga/escalabilidad | [README](./observability/README.md) |

---

## 🚀 Inicio Rápido

> 📖 Para instrucciones detalladas de entorno, migraciones, troubleshooting y apagado seguro, consulta la [**Guía de Levantamiento del Proyecto**](./docs/equipo-2-pruebas/IniciarElProyecto/COMO_LEVANTAR_PROYECTO.md).

### 1. Levantar Backend Principal e Infraestructura (`core-service` + PostgreSQL + RabbitMQ + MinIO)

```bash
docker compose -f core-service/compose.dev.yml up -d
```

### 2. Levantar Microservicios Auxiliares y Observabilidad

```bash
docker compose -f notification-service/compose.yml up -d
docker compose -f tracking-service/docker-compose.yml up -d
docker compose -f ai-service/compose.yml up -d
docker compose -f observability/docker-compose.yml up -d
```

### 3. Iniciar el Panel Administrativo Web (`admin-app`)

```bash
cd admin-app
npm install
npm run dev
```

Abre en el navegador: **http://localhost:3000**

<details>
<summary>🔑 <strong>Ver accesos y credenciales locales de desarrollo</strong></summary>

<br />

| Servicio | URL / Dirección | Usuario / CPF | Contraseña |
|---|---|---|---|
| **Panel Web Admin (`admin-app`)** | `http://localhost:3000` | `000.000.000-00` | `123456` |
| **Core Service API** | `http://localhost:3333` | — | — |
| **PostgreSQL (`sif-dev`)** | `localhost:5431` | `postgres-dev` | `postgres-dev` |
| **RabbitMQ Management** | `http://localhost:15672` | `admin` | `admin` |
| **MinIO / S3 Console** | `http://localhost:9001` | `minioadmin` | `minioadmin` |
| **MailHog** | `http://localhost:8025` | *(sin login)* | *(sin login)* |
| **Prometheus** | `http://localhost:9090` | — | — |
| **Grafana** | `http://localhost:3001` | `admin` | `admin` |

</details>

---

## 🧪 Calidad, Pruebas y Métricas

El proyecto cuenta con una estrategia multipropósito ejecutada por el **Equipo 2 (QA)** que cubre pruebas unitarias, de componente HTTP, de mutación, E2E en navegador, resiliencia, observabilidad y carga:

| Capa / Servicio | Herramienta | Resultado Verificado | Cobertura / SLA | Informe / Evidencia |
|---|---|---|---|---|
| **Core Service (Integrada)** | Vitest + V8 + Biome + `tsc` | **`121 passed \| 21 skipped`** (`0` errores `tsc`/`lint`/`build`) | **`100%` V8** en los 15 módulos objetivo de David | [Relatoría David](./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md) · [Integración](./docs/equipo-2-pruebas/relatorios/relatorio_integracion.md) |
| **Core Service (Mutación)** | StrykerJS (`perTest`) | **`98.92%`** (`183/185` muertos, `0` sin cobertura) | **`100%`** en todos los `use-cases` (`135/135`) y `hooks` (`18/18`) | [Sección Fase 2](./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md#6-consolidación-final-y-validación-global-fase-2) |
| **Admin Web (E2E)** | Playwright (Chromium) | **`2/2 PASS`** (`TC-ADMIN-001` positivo + negativo) | Cookie `token` httpOnly + redirección `/` | [Evidencia E2E](./evidencias/TC-ADMIN-001/dashboard-authenticated.png) |
| **Tracking Service (Go)** | `go test` (`httptest` + AMQP) | **`100% PASS`** (`TC-TRACK-001..004` + reconexión `INC-ANDY-002`) | **`68.1%`** global (`internal/server`: `100%`, `reconnectLocked`: `100%`) | [Evidencia Tracking](./evidencias/TC-TRACK.txt) |
| **AI Service (Python)** | Pytest + `pytest-cov` | **`7/7 PASS`** (`TC-AI-001..002` + `/reports/fleet` `INC-ANDY-001`) | **`93.0%`** cobertura global (`app/`) | [Evidencia IA](./evidencias/TC-AI.txt) |
| **Observabilidad & Carga** | Prometheus + Grafana + k6 + Nginx | **`3/3` targets UP**, Smoke **`74/74`** checks, Load 1 vs 2 inst. | Smoke `p(95) = 131.21 ms` (`< 500 ms`), `0.00%` errores | [Resumen QA](./docs/equipo-2-pruebas/relatorios/04_RELATORIO_RESUMO.md) · [Carga k6](./evidencias/TC-OBS-003.md) |

<details>
<summary>⚡ <strong>Comandos para ejecutar las suites de prueba</strong></summary>

<br />

```bash
# Core Service (Vitest, Cobertura V8, Mutación StrykerJS, TypeScript, Biome y Build)
cd core-service
npm run test
npm run test:coverage
npm run test:mutation
npx tsc --noEmit && npm run lint && npm run build

# Tracking Service (Go)
cd tracking-service
go test -v -coverpkg=./internal/... ./...

# AI Service (Python / Pytest)
cd ai-service
pytest -v --cov=app

# Admin App E2E (Playwright — requiere core-service y admin-app activos)
cd admin-app
npx playwright test
```

</details>

---

## 📚 Centro de Documentación Unificada

Toda la documentación del repositorio fue consolidada dentro de **[`docs/`](./docs/README.md)** y organizada por equipo:

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>🏗️ Equipo 1 — Desarrollo & Arquitectura</h4>
      <ul>
        <li><a href="./docs/equipo-1-desarrollo/">Explorar carpeta <code>docs/equipo-1-desarrollo/</code></a></li>
        <li><a href="./docs/equipo-1-desarrollo/Documentos%20de%20Requisitos%20-%20SIF.pdf">Documentos de Requisitos (RF001–RF016)</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Casos%20de%20Uso%20-%20SIF.pdf">Casos de Uso — SIF</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Diagrama%20Container%20-%20SIF.pdf">Diagramas C4 (Contexto, Container, Componentes)</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Modelo%20L%C3%B3gico%20-%20SIF.pdf">Modelo Lógico y Diagrama de Clases</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Relat%C3%B3rio%20de%20Processo%20de%20Software%20detalhado.pdf">Relatório de Processo (Scrumban)</a></li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🧪 Equipo 2 — Calidad & Pruebas (QA)</h4>
      <ul>
        <li><a href="./docs/README.md"><strong>Abrir Hub Visual de Documentación (<code>docs/README.md</code>)</strong></a></li>
        <li><a href="./docs/equipo-2-pruebas/documentos-oficiales/Plano%20de%20Teste%20%E2%80%94%20SIF%20(Sistema%20Integrado%20de%20Frotas).pdf">Plano de Teste Oficial (PDF)</a></li>
        <li><a href="./docs/equipo-2-pruebas/documentos-oficiales/Casos%20de%20Teste%20%E2%80%94%20SIF.pdf">Casos de Teste Oficiales — 36 Casos (PDF)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md">Relatoría Completa Core Service (David Párraga)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/03_RELATORIO_INCIDENTES.md">Relatório de Incidentes (Andy Merchán)</a> &amp; <a href="./docs/equipo-2-pruebas/relatorios/04_RELATORIO_RESUMO.md">Resumen (04)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/relatorio_integracion.md">Relatoría de Integración de Ramas</a></li>
      </ul>
    </td>
  </tr>
</table>

---

## 👥 Equipos y Créditos

### 🏗️ Equipo 1 — Desarrollo de Software
| Integrante | Rol / Participación |
|---|---|
| **Everton Gean** | Desarrollo de Software — Sistema Integrado de Frotas (SIF) |
| **João Manoel** | Desarrollo de Software & Product Owner informal *(Relatório de Processo)* |
| **Sara Lima** | Desarrollo de Software *(y pruebas en Equipo 2)* |
| **Vitor Júnior** | Desarrollo de Software — Sistema Integrado de Frotas (SIF) |

### 🧪 Equipo 2 — Calidad y Pruebas de Software (QA)
| Integrante | Rol / Foco Principal | Rama de Trabajo |
|---|---|---|
| **David Párraga** | Pruebas `core-service` (`TC-CORE-001`..`014`), Cobertura V8, StrykerJS e Integración | `test/david-core-auth-fleet` |
| **Andy Merchán** | E2E `admin-app` (Playwright), `tracking-service` (Go), `ai-service` (Pytest), Observabilidad/k6 e Incidentes | `test/andy-web-observability-ai` |
| **Sara Lima** | Flujo de Solicitudes, Conflictos Horarios, Aprobación/Rechazo, Rutas y Tracks (`core-service` + PostgreSQL) | `test/sara-core-trips-rabbitmq` |

---

<div align="center">

**FlotaFacil — Sistema Integrado de Frotas (SIF)** · IFRN — Proyecto Integrador

<br />
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,55:1D4ED8,100:0F172A&height=110&section=footer" width="100%" alt="FlotaFacil Footer" />

</div>
