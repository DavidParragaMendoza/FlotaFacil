<div align="center">

<!-- Header Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F172A,45:1D4ED8,100:10B981&height=230&section=header&text=FlotaFacil%20%E2%80%94%20SIF&fontSize=54&fontColor=FFFFFF&fontAlignY=38&desc=Sistema%20Integrado%20de%20Frotas%20%7C%20Arquitetura%20de%20Microsservi%C3%A7os%20e%20Qualidade%20de%20Software&descSize=16&descAlignY=63&animation=fadeIn" width="100%" alt="FlotaFacil — SIF Banner" />

<br />

<!-- Language Switcher -->
<p>
  <a href="./README.md">
    <img src="https://img.shields.io/badge/Cambiar_a-Espa%C3%B1ol-1E293B?style=for-the-badge&logo=googletranslate&logoColor=white" alt="Ver en Español" />
  </a>
  <img src="https://img.shields.io/badge/Idioma-Portugu%C3%AAs_(Atual)-10B981?style=for-the-badge" alt="Português Atual" />
</p>

<!-- Navigation Action Buttons -->
<a href="#-arquitetura-do-sistema">
  <img src="https://img.shields.io/badge/Arquitetura-Microsservi%C3%A7os-1D4ED8?style=for-the-badge&logo=diagramsdotnet&logoColor=white" alt="Arquitetura" />
</a>
<a href="#-servi%C3%A7os-e-portas">
  <img src="https://img.shields.io/badge/Servi%C3%A7os-6_M%C3%B3dulos-0E7490?style=for-the-badge&logo=docker&logoColor=white" alt="Serviços" />
</a>
<a href="#-in%C3%ADcio-r%C3%A1pido">
  <img src="https://img.shields.io/badge/In%C3%ADcio_R%C3%A1pido-Docker_%26_Local-10B981?style=for-the-badge&logo=rocket&logoColor=white" alt="Início Rápido" />
</a>
<a href="#-qualidade-testes-e-m%C3%A9tricas">
  <img src="https://img.shields.io/badge/Testes_%26_QA-98.92%25_Muta%C3%A7%C3%A3o-7C3AED?style=for-the-badge&logo=vitest&logoColor=white" alt="Qualidade e Testes" />
</a>
<a href="./docs/README.pt-BR.md">
  <img src="https://img.shields.io/badge/Documenta%C3%A7%C3%A3o-Central_Unificada-D97706?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentação" />
</a>
<a href="#-equipes-e-cr%C3%A9ditos">
  <img src="https://img.shields.io/badge/Equipes-IFRN-0F172A?style=for-the-badge&logo=github&logoColor=white" alt="Equipes" />
</a>

<br /><br />

<!-- Quality & Status Badges -->
<img src="https://img.shields.io/badge/Core_Vitest-121_passed_%7C_21_skipped-22C55E?style=flat-square&logo=vitest&logoColor=white" alt="Core Tests" />
<img src="https://img.shields.io/badge/StrykerJS_Mutation-98.92%25_(183%2F185)-8B5CF6?style=flat-square&logo=stryker&logoColor=white" alt="Stryker Mutation Score" />
<img src="https://img.shields.io/badge/Cobertura_V8_Alvo-100%25_(15%2F15_m%C3%B3dulos)-10B981?style=flat-square" alt="V8 Target Coverage" />
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

## 🚛 Sobre o Projeto

O **FlotaFacil — SIF (Sistema Integrado de Frotas)** é uma plataforma distribuída projetada para a **gestão digital de frotas municipais**, desenvolvida no contexto do Projeto Integrador do **IFRN (Campus Pau dos Ferros)**.

O sistema digitaliza todo o ciclo operacional dos veículos:

- 🔐 **Autenticação e RBAC:** acesso diferenciado para administradores (CPF + senha) e motoristas (e-mail + senha) via JWT.
- 🚗 **Gestão de Frota:** cadastro, edição, exclusão, controle de disponibilidade por agenda e unicidade de placas.
- 📅 **Solicitações e Aprovações:** criação de reservas com bloqueio anti-conflito de horário (veículo e motorista), aprovação/recusa administrativa e trilha de auditoria.
- 📍 **Rastreamento GPS em Tempo Real:** ingestão de coordenadas em Go publicada via RabbitMQ, persistência de rotas/tracks e geração de mapas estáticos em armazenamento S3/MinIO.
- 🤖 **Relatórios Analíticos com IA:** geração automatizada de resumos executivos de rotas e frota com FastAPI + OpenAI.
- 🔔 **Notificações e Observabilidade:** alertas por e-mail/push e monitoramento em tempo real com métricas Prometheus, dashboards Grafana e testes de carga k6.

---

## 🏛️ Arquitetura do Sistema

```mermaid
flowchart TB
    subgraph Clients["💻 Aplicações Cliente"]
        ADMIN["🖥️ Admin App<br/>Next.js 16 (:3000)"]
        MOBILE["📱 App Client<br/>Expo / React Native"]
    end

    subgraph Services["⚙️ Microsserviços"]
        CORE["🧠 Core Service<br/>Fastify 5 + Drizzle (:3333)"]
        TRACK["📍 Tracking Service<br/>Go HTTP API (:8080)"]
        AI["🤖 AI Service<br/>Python FastAPI (:8001)"]
        NOTIF["🔔 Notification Service<br/>Fastify + Nodemailer (:3331)"]
    end

    subgraph Infra["🗄️ Infraestrutura & Mensageria"]
        PG[("🐘 PostgreSQL 16<br/>(:5431 / :5432)")]
        RMQ(("🐇 RabbitMQ<br/>(:5672 / :15672)"))
        S3[("🪣 MinIO / S3<br/>(:9000 / :9001)")]
        MAIL["✉️ MailHog<br/>(:8025)"]
    end

    subgraph Obs["📈 Observabilidade"]
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

## 🧩 Serviços e Portas

| Serviço | Tecnologia | Porta Local | Responsabilidade | Documentação |
|---|---|---|---|---|
| **[`core-service`](./core-service/)** | Node.js 22, Fastify 5, Drizzle, PostgreSQL, Zod, Biome | `:3333` | API central: auth, RBAC, usuários, veículos, solicitações, rotas, tracks, auditoria e relatórios | [README](./core-service/README.md) |
| **[`admin-app`](./admin-app/)** | Next.js 16, React 19, Tailwind CSS 4, Playwright | `:3000` | Painel web administrativo para gestores da frota | [README](./admin-app/README.md) |
| **[`App-client`](./App-client/)** | Expo 54, React Native 0.81, TypeScript, Expo Router | Expo | Aplicativo mobile para motoristas (solicitações, viagens e GPS em segundo plano) | [README](./App-client/README.md) |
| **[`tracking-service`](./tracking-service/)** | Go, `net/http`, AMQP (reconexão automática) | `:8080` | Ingestão de coordenadas GPS e publicação no RabbitMQ (`tracking.updated`) | [README](./tracking-service/README.md) |
| **[`ai-service`](./ai-service/)** | Python, FastAPI, Pydantic, OpenAI API, Pytest | `:8001` | Geração de relatórios analíticos de rotas (`/reports/routes`) e frota (`/reports/fleet`) | [README](./ai-service/README.md) |
| **[`notification-service`](./notification-service/)** | Node.js, Fastify 5, `amqplib`, Nodemailer | `:3331` | Consumo de eventos de solicitações e envio de notificações | [`package.json`](./notification-service/package.json) |
| **[`observability`](./observability/)** | Prometheus, Grafana, Nginx, k6 | `:9090` / `:3001` | Coleta de métricas, dashboards SIF e testes de carga/escalabilidade | [README](./observability/README.md) |

---

## 🚀 Início Rápido

> 📖 Para instruções detalhadas de ambiente, migrações, solução de problemas e desligamento seguro, consulte o [**Guia de Execução do Projeto**](./docs/equipo-2-pruebas/IniciarElProyecto/COMO_LEVANTAR_PROYECTO.md).

### 1. Subir o Backend Principal e Infraestrutura (`core-service` + PostgreSQL + RabbitMQ + MinIO)

```bash
docker compose -f core-service/compose.dev.yml up -d
```

### 2. Subir Microsserviços Auxiliares e Observabilidade

```bash
docker compose -f notification-service/compose.yml up -d
docker compose -f tracking-service/docker-compose.yml up -d
docker compose -f ai-service/compose.yml up -d
docker compose -f observability/docker-compose.yml up -d
```

### 3. Iniciar o Painel Administrativo Web (`admin-app`)

```bash
cd admin-app
npm install
npm run dev
```

Acesse no navegador: **http://localhost:3000**

<details>
<summary>🔑 <strong>Ver acessos e credenciais locais de desenvolvimento</strong></summary>

<br />

| Serviço | URL / Endereço | Usuário / CPF | Senha |
|---|---|---|---|
| **Painel Web Admin (`admin-app`)** | `http://localhost:3000` | `000.000.000-00` | `123456` |
| **Core Service API** | `http://localhost:3333` | — | — |
| **PostgreSQL (`sif-dev`)** | `localhost:5431` | `postgres-dev` | `postgres-dev` |
| **RabbitMQ Management** | `http://localhost:15672` | `admin` | `admin` |
| **MinIO / S3 Console** | `http://localhost:9001` | `minioadmin` | `minioadmin` |
| **MailHog** | `http://localhost:8025` | *(sem login)* | *(sem login)* |
| **Prometheus** | `http://localhost:9090` | — | — |
| **Grafana** | `http://localhost:3001` | `admin` | `admin` |

</details>

---

## 🧪 Qualidade, Testes e Métricas

O projeto conta com uma estratégia completa executada pela **Equipe 2 (QA)** abrangendo testes unitários, de componente HTTP, mutação, E2E no navegador, resiliência, observabilidade e carga:

| Camada / Serviço | Ferramenta | Resultado Verificado | Cobertura / SLA | Relatório / Evidência |
|---|---|---|---|---|
| **Core Service (Integrada)** | Vitest + V8 + Biome + `tsc` | **`121 passed \| 21 skipped`** (`0` erros `tsc`/`lint`/`build`) | **`100%` V8** nos 15 módulos alvo de David | [Relatório David](./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md) · [Integração](./docs/equipo-2-pruebas/relatorios/relatorio_integracion.md) |
| **Core Service (Mutação)** | StrykerJS (`perTest`) | **`98.92%`** (`183/185` mortos, `0` sem cobertura) | **`100%`** em todos os `use-cases` (`135/135`) e `hooks` (`18/18`) | [Seção Fase 2](./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md#6-consolidación-final-y-validación-global-fase-2) |
| **Admin Web (E2E)** | Playwright (Chromium) | **`2/2 PASS`** (`TC-ADMIN-001` positivo + negativo) | Cookie `token` httpOnly + redirecionamento `/` | [Evidência E2E](./evidencias/TC-ADMIN-001/dashboard-authenticated.png) |
| **Tracking Service (Go)** | `go test` (`httptest` + AMQP) | **`100% PASS`** (`TC-TRACK-001..004` + reconexão `INC-ANDY-002`) | **`68.1%`** global (`internal/server`: `100%`, `reconnectLocked`: `100%`) | [Evidência Tracking](./evidencias/TC-TRACK.txt) |
| **AI Service (Python)** | Pytest + `pytest-cov` | **`7/7 PASS`** (`TC-AI-001..002` + `/reports/fleet` `INC-ANDY-001`) | **`93.0%`** cobertura global (`app/`) | [Evidência IA](./evidencias/TC-AI.txt) |
| **Observabilidade & Carga** | Prometheus + Grafana + k6 + Nginx | **`3/3` targets UP**, Smoke **`74/74`** checks, Load 1 vs 2 inst. | Smoke `p(95) = 131.21 ms` (`< 500 ms`), `0.00%` erros | [Resumo QA](./docs/equipo-2-pruebas/relatorios/04_RELATORIO_RESUMO.md) · [Carga k6](./evidencias/TC-OBS-003.md) |

<details>
<summary>⚡ <strong>Comandos para executar as suítes de teste</strong></summary>

<br />

```bash
# Core Service (Vitest, Cobertura V8, Mutação StrykerJS, TypeScript, Biome e Build)
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

# Admin App E2E (Playwright — requer core-service e admin-app ativos)
cd admin-app
npx playwright test
```

</details>

---

## 📚 Central de Documentação Unificada

Toda a documentação do repositório foi consolidada dentro de **[`docs/`](./docs/README.pt-BR.md)** e organizada por equipe:

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>🏗️ Equipe 1 — Desenvolvimento &amp; Arquitetura</h4>
      <ul>
        <li><a href="./docs/equipo-1-desarrollo/">Explorar pasta <code>docs/equipo-1-desarrollo/</code></a></li>
        <li><a href="./docs/equipo-1-desarrollo/Documentos%20de%20Requisitos%20-%20SIF.pdf">Documentos de Requisitos (RF001–RF016)</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Casos%20de%20Uso%20-%20SIF.pdf">Casos de Uso — SIF</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Diagrama%20Container%20-%20SIF.pdf">Diagramas C4 (Contexto, Container, Componentes)</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Modelo%20L%C3%B3gico%20-%20SIF.pdf">Modelo Lógico e Diagrama de Classes</a></li>
        <li><a href="./docs/equipo-1-desarrollo/Relat%C3%B3rio%20de%20Processo%20de%20Software%20detalhado.pdf">Relatório de Processo (Scrumban)</a></li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🧪 Equipe 2 — Qualidade &amp; Testes (QA)</h4>
      <ul>
        <li><a href="./docs/README.pt-BR.md"><strong>Abrir Central Visual de Documentação (<code>docs/README.pt-BR.md</code>)</strong></a></li>
        <li><a href="./docs/equipo-2-pruebas/documentos-oficiales/Plano%20de%20Teste%20%E2%80%94%20SIF%20(Sistema%20Integrado%20de%20Frotas).pdf">Plano de Teste Oficial (PDF)</a></li>
        <li><a href="./docs/equipo-2-pruebas/documentos-oficiales/Casos%20de%20Teste%20%E2%80%94%20SIF.pdf">Casos de Teste Oficiais — 36 Casos (PDF)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/relatorio_completo_test_david.md">Relatório Completo Core Service (David Párraga)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/03_RELATORIO_INCIDENTES.md">Relatório de Incidentes (Andy Merchán)</a> &amp; <a href="./docs/equipo-2-pruebas/relatorios/04_RELATORIO_RESUMO.md">Resumo (04)</a></li>
        <li><a href="./docs/equipo-2-pruebas/relatorios/relatorio_integracion.md">Relatório de Integração de Branches</a></li>
      </ul>
    </td>
  </tr>
</table>

---

## 👥 Equipes e Créditos

### 🏗️ Equipe 1 — Desenvolvimento de Software
| Integrante | Papel / Participação |
|---|---|
| **Everton Gean** | Desenvolvimento de Software — Sistema Integrado de Frotas (SIF) |
| **João Manoel** | Desenvolvimento de Software & Product Owner informal *(Relatório de Processo)* |
| **Sara Lima** | Desenvolvimento de Software *(e testes na Equipe 2)* |
| **Vitor Júnior** | Desenvolvimento de Software — Sistema Integrado de Frotas (SIF) |

### 🧪 Equipe 2 — Qualidade e Testes de Software (QA)
| Integrante | Papel / Foco Principal | Branch de Trabalho |
|---|---|---|
| **David Párraga** | Testes `core-service` (`TC-CORE-001`..`014`), Cobertura V8, StrykerJS e Integração | `test/david-core-auth-fleet` |
| **Andy Merchán** | E2E `admin-app` (Playwright), `tracking-service` (Go), `ai-service` (Pytest), Observabilidade/k6 e Incidentes | `test/andy-web-observability-ai` |
| **Sara Lima** | Fluxo de Solicitações, Conflitos de Horário, Aprovação/Recusa, Rotas e Tracks (`core-service` + PostgreSQL) | `test/sara-core-trips-rabbitmq` |

---

<div align="center">

**FlotaFacil — Sistema Integrado de Frotas (SIF)** · IFRN — Projeto Integrador

<br />
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:10B981,55:1D4ED8,100:0F172A&height=110&section=footer" width="100%" alt="FlotaFacil Footer" />

</div>
