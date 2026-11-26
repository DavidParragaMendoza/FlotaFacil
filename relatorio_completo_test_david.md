# Relatoría Completa de Auditoría, Pruebas y Calidad — SIF (`core-service`)

- **Responsable:** David Párraga
- **Rama Git:** `test/david-core-auth-fleet`
- **Commit Base Auditado:** `b2d6811`
- **Fecha de Inicio de Auditoría (Fase 0):** `2026-11-26`
- **Fuentes Oficiales Rectoras:**
  - `Casos de Teste — SIF.pdf` (36 casos planeados — fuente oficial de IDs, roteiros y resultados esperados).
  - `Plano de Teste — SIF (Sistema Integrado de Frotas).pdf` (criterios metodológicos, cobertura mínima >= 80%, mutación y trazabilidad).
- **Plan de Acción Asociado:** `.agents/plan_accion_auditoria_tests_david.md`
- **Relatoría Anterior (preservada como registro histórico):** `RELATORIA_TESTES_DAVID.md`

> **Nota metodológica sobre el alcance de las pruebas:** La suite `core-service/tests/david-core.spec.ts` ejecuta pruebas de **componente HTTP / ruta** levantando la instancia real de Fastify (`src/app.ts` + `app.inject`) junto con el validador/serializador Zod y `@fastify/jwt`, pero aislando la infraestructura externa (repositorios Drizzle/PostgreSQL, RabbitMQ, `createAuditLog` y `notification-service`) mediante `vi.mock`. En consecuencia, estas pruebas validan contratos HTTP, hooks de autenticación/autorización, lógica de casos de uso y llamadas esperadas a dependencias; **no demuestran persistencia física en PostgreSQL ni publicación real en RabbitMQ**, lo cual pertenece a la capa de pruebas de integración con Docker Compose.

---

## 1. Auditoría del Trabajo Previo (Commit `b2d6811`)

Al contrastar el historial registrado en `.agents/contextodelaimplementaciondelostest.md`, la relatoría anterior (`RELATORIA_TESTES_DAVID.md`) y el código real de `core-service` contra los documentos oficiales del proyecto, se identificaron las siguientes debilidades:

### 1.1 Debilidades Documentales y de Trazabilidad
1. **Estructura no conforme al estándar requerido:** `RELATORIA_TESTES_DAVID.md` emplea un formato narrativo (`Identificador / Archivo / Estrategia / Resultado`) en vez de la secuencia estricta:
   `Caso de Teste -> Tipo de Caso & Criterio Usado -> Resultado Esperado -> Resultado Obtenido (+ Diagnóstico / Corrección / Revalidación)`.
2. **Ausencia de Tipo de Caso y Criterio Usado:** No clasifica los escenarios según el PDF (`happy path`, `boundary`, `special-input`, `failure`), ni explicita el nivel real (`app.inject` con mocks vs. integración real) ni la técnica aplicada (Partición de Equivalencia, Análisis de Valor Límite, Contrato Zod, RBAC, Mutación).
3. **Ocultamiento de errores reales detectados y corregidos:** En `TC-CORE-003` (`src/contracts/users/user-login-schema.ts`) y `TC-CORE-007` (`src/contracts/users/create-user-schema.ts`), el agente anterior encontró defectos en los esquemas de producción, los modificó y reportó directamente `PASS` sin documentar el fallo previo ni el ciclo `requisito -> caso -> ejecución -> incidente -> corrección`.
4. **Afirmaciones que exceden el alcance de los mocks:** Reporta "persistencia", "auditoría" y "publicación de eventos" cuando la suite simula con `vi.mock` todos los repositorios Drizzle, `createAuditLog`, `notifyAdminsAboutNewRequest` y RabbitMQ.
5. **Inconsistencias de evidencia y tiempos:** Los tiempos HTTP descritos en las secciones de `RELATORIA_TESTES_DAVID.md` no coinciden con la tabla consolidada final (por ejemplo, `TC-CORE-001` indica `98.24 ms` en el texto vs. `88.78 ms` en la tabla; `TC-CORE-009` indica `0.66 ms` vs. `1.30 ms`), al mezclar corridas sin fecha ni commit SHA.
6. **Divergencia de numeración documental:** El archivo anterior `docs/01_PRIMEIRA_ENTREGA/02_CASOS_DE_TESTE.md` (40 casos) desplaza los IDs desde `TC-CORE-008` en adelante. Se confirma **`Casos de Teste — SIF.pdf` como fuente oficial única**, donde la fila 4 corresponde a `TC-ADMIN-001` (por lo que no existe `TC-CORE-004` en `core-service`) y `TC-CORE-09` es un error tipográfico del PDF normalizado como `TC-CORE-009`.

### 1.2 Debilidades en Herramientas, Configuración y Código de Pruebas
1. **Ausencia de Cobertura y Pruebas de Mutación:** Pese a que `Plano de Teste — SIF (Sistema Integrado de Frotas).pdf` (§3.1 y §5) exige **cobertura mínima >= 80%** en `use-cases`/dominio y **pruebas de mutación** en la 2ª entrega, `core-service/package.json` no incluía `@vitest/coverage-v8` ni `@stryker-mutator/core`.
2. **Riesgo de fallo en CI Linux (`core-service/biome.json`):** El commit `b2d6811` fijó `"lineEnding": "crlf"` en `core-service/biome.json`. Dado que en Windows `git config core.autocrlf` está en `true`, pero el workflow `.github/workflows/core-ci.yml` corre en `ubuntu-latest` (normalmente con saltos `LF`), esta regla puede hacer fallar `npm run lint` en GitHub Actions.
3. **Error silencioso en `core-service/tests/use-cases.spec.ts`:** El mock `saveTrackingMapToMinio: vi.fn()` agregado en `b2d6811` devolvía `undefined`, disparando un `TypeError: Cannot read properties of undefined (reading 'imageKey')` en `stderr` durante la ejecución de `createTrackUseCase`.
4. **Incompletitudes y debilidades frente al PDF y mutantes en `core-service/tests/david-core.spec.ts`:**
   - `TC-CORE-006` omite el Paso 2 (`GET /admin/users/:id`).
   - `TC-CORE-008` omite verificar la visibilidad del vehículo en `GET /admin/vehicles`.
   - `TC-CORE-011` solo prueba rol `driver` (no `admin`), no verifica los argumentos enviados a `findVehicleScheduleConflict` ni valida el límite de fechas (`end <= start`).
   - `TC-CORE-012` omite el Paso 3 (`GET /admin/vehicles` confirmando vehículo ausente) y no valida los argumentos enviados a `updateVehicleRepository`.
   - Varios casos negativos (`TC-CORE-002`, `TC-CORE-003`, `TC-CORE-010`, `TC-CORE-014`) agrupan múltiples condiciones en una sola petición o bucle sin aislar cada regla contra mutantes, y `TC-CORE-001` / `TC-CORE-005` no cubren ramas de error o autorización `403`.

---

## 2. Fase 0 — Preparación, Instalación de Herramientas y Línea Base

### 2.1 Paquetes Instalados en `core-service`
Instalados como `devDependencies` compatibles con `vitest@^4.1.10`:
- `@vitest/coverage-v8`: `^4.1.10`
- `@stryker-mutator/core`: `^10.1.1`
- `@stryker-mutator/vitest-runner`: `^10.1.1`

### 2.2 Archivos Creados y Modificados en Fase 0
| Archivo | Propósito / Cambio realizado |
|---|---|
| `.agents/plan_accion_auditoria_tests_david.md` | Nuevo plan maestro de auditoría por fases y criterio por caso. |
| `relatorio_completo_test_david.md` | Esta relatoría técnica completa (sin sobrescribir `RELATORIA_TESTES_DAVID.md`). |
| `core-service/package.json` y `core-service/package-lock.json` | Nuevos scripts `"test:coverage": "vitest run --coverage"` y `"test:mutation": "stryker run"`, más dependencias de cobertura y mutación. |
| `core-service/vitest.config.ts` | Configuración de proveedor V8 (`text`, `json-summary`, `html`), inclusión `src/**/*.ts` y exclusión de `src/server.ts`, `src/drizzle/**`, `src/**/*.d.ts`. |
| `core-service/stryker.config.mjs` | Configuración de StrykerJS con `@stryker-mutator/vitest-runner`, `coverageAnalysis: "perTest"`, reportes `html`, `clear-text`, `progress` y `json`, apuntando a los 13 módulos de contratos, hooks y casos de uso cubiertos por David. |
| `core-service/.gitignore` | Exclusión de artefactos generados `.stryker-tmp/` y `reports/`. |
| `core-service/tests/use-cases.spec.ts` | Corrección del mock en `createTrackUseCase` (`generateTrackingStaticMap` y `saveTrackingMapToMinio`). |

### 2.3 Incidencias Técnicas Resueltas y Advertencias en Fase 0
1. **Corrección del `TypeError` en `stderr` dentro de `core-service/tests/use-cases.spec.ts`:**
   - **Problema:** Al ejecutar `npm.cmd run test`, el caso `"cria track apenas quando a rota existe"` imprimía en `stderr`: `TypeError: Cannot read properties of undefined (reading 'imageKey')` en `src/use-cases/tracks/create-track.ts:46`, porque `saveTrackingMapToMinio` estaba mockeado devolviendo `undefined`.
   - **Solución:** Se importaron `generateTrackingStaticMap` y `saveTrackingMapToMinio` y se configuraron sus retornos con `mockResolvedValue` dentro del test (respetando `restoreMocks: true` de `vitest.config.ts`), incluyendo la propiedad requerida `bucket: "sif-dev"` de `SaveTrackingMapOutput`.
   - **Resultado:** `tests/use-cases.spec.ts` pasa `24/24` sin errores en `stderr` y `tsc --noEmit` con `0` errores.
2. **Resolución de rutas excluidas en el sandbox de StrykerJS (`core-service/stryker.config.mjs`):**
   - **Problema:** Al usar inicialmente `ignorePatterns: ["dist", "coverage", "reports", ".stryker-tmp", "drizzle"]`, StrykerJS excluía cualquier subcarpeta llamada `drizzle` o `reports` en todo el árbol (`src/drizzle/` y `src/**/reports/`), causando errores `Cannot find package '@/drizzle/client'` y `Cannot find package '@/contracts/reports/generate-fleet-report-schema'` dentro de `.stryker-tmp/sandbox-*`.
   - **Solución:** Se eliminó `"drizzle"` y se anclaron los patrones a la raíz del paquete: `ignorePatterns: ["/dist", "/coverage", "/reports", "/.stryker-tmp"]`. Stryker pasó a indexar los `209` archivos fuente completos.
3. **Advertencia de compatibilidad CI Linux (`core-service/biome.json`):**
   - **Observación:** `core-service/biome.json` mantiene `"lineEnding": "crlf"` y en Windows `git config --get core.autocrlf` devuelve `true`. No se reformatearon los 147 archivos del repositorio en Fase 0 para no contaminar el historial; sin embargo, **se registra como riesgo activo** para el job `npm run lint` en `.github/workflows/core-ci.yml` (`ubuntu-latest`), el cual conviene normalizar antes de cerrar la entrega o mediante `.gitattributes`.

### 2.4 Evidencia Real de Línea Base (Post-Fase 0, `2026-11-26`)

| Verificación | Comando Ejecutado (`core-service/`) | Resultado Observado |
|---|---|---|
| Chequeo de tipos | `npx.cmd tsc --noEmit` | **PASS** — `0` errores (`exit code 0`). |
| Linter y formato | `npm.cmd run lint` (`biome check`) | **PASS** — `147` archivos verificados en `191 ms`, `0` errores. |
| Compilación producción | `npm.cmd run build` (`tsc --project tsconfig.build.json && tsc-alias`) | **PASS** — Compilación limpia (`exit code 0`). |
| Suite + Cobertura V8 | `npm.cmd run test:coverage` (`vitest run --coverage`) | **PASS** — `2` archivos, **37/37 tests** en verde (`9.55 s`), `stderr` limpio. |
| Smoke Test Mutación | `npx.cmd stryker run -m "src/hooks/verify-jwt.ts"` | **PASS** — **100.00%** mutation score (`5` instrumentados, `5` muertos, `0` sobrevivientes, `0` errores; `40 s`). |

#### Cobertura V8 Global y de Módulos Objetivo (Línea Base Fase 0)
- **Global `core-service` (`All files`):** `34.32% Stmts` (`425/1238`) | `24.95% Branch` (`129/517`) | `24.49% Funcs` (`73/298`) | `34.53% Lines` (`420/1216`).

| Archivo Objetivo (`src/...`) | % Stmts | % Branch | % Funcs | % Lines | Líneas sin cubrir |
|---|---|---|---|---|---|
| `contracts/users/user-login-schema.ts` | `100` | `100` | `100` | `100` | `—` |
| `contracts/users/create-user-schema.ts` | `100` | `100` | `100` | `100` | `—` |
| `contracts/vehicles/register-vehicle-request-schema.ts` | `100` | `100` | `100` | `100` | `—` |
| `contracts/requests/create-my-request-schema.ts` | `100` | `100` | `100` | `100` | `—` |
| `hooks/verify-jwt.ts` | `100` | `100` | `100` | `100` | `—` |
| `hooks/authorize.ts` | `66.66` | `50` | `100` | `66.66` | `9, 13` |
| `use-cases/authenticate-admin.ts` | `77.77` | `50` | `100` | `100` | `15-22` *(ramas de error)* |
| `use-cases/users/create-user.ts` | `88.88` | `83.33` | `100` | `100` | `26` |
| `use-cases/users/fetch-user-by-id.ts` | `0` | `0` | `0` | `0` | `11-17` |
| `use-cases/vehicles/register-vehicle.ts` | `100` | `100` | `100` | `100` | `—` |
| `use-cases/vehicles/fetch-vehicles.ts` | `0` | `100` | `0` | `0` | `8-10` |
| `use-cases/vehicles/fetch-available-vehicles.ts` | `73.33` | `58.33` | `83.33` | `78.57` | `23-27, 35` |
| `use-cases/vehicles/update-vehicle.ts` | `72.72` | `70` | `100` | `72.72` | `24, 30, 44` |
| `use-cases/vehicles/delete-vehicle.ts` | `71.42` | `50` | `100` | `71.42` | `16, 22` |
| `use-cases/requests/create-my-request.ts` | `65` | `50` | `100` | `65` | `30-46, 60, 64, 68` |

---

## 3. Estructura Obligatoria por Caso de Prueba (Fase 1)

Cada uno de los 13 casos será auditado uno a la vez y documentado siguiendo exactamente estas 4 secciones:

1. **Caso de Teste:** ID oficial (`Casos de Teste — SIF.pdf`), módulo, requisito (`RF-XX`), endpoint/escenario, precondiciones y archivo de prueba.
2. **Tipo de Caso & Criterio Usado:** Nivel real de prueba (`app.inject` con mocks vs. integración real), categoría (`happy path`, `boundary`, `special-input`, `failure`) y técnica/criterio aplicado (Partición de Equivalencia, Análisis de Valor Límite, Validación de Contrato Zod, RBAC, Cobertura/Mutación).
3. **Resultado Esperado:** Código HTTP, estructura JSON, efectos esperados y verificación negativa (efectos que NO deben ocurrir) según el PDF oficial.
4. **Resultado Obtenido:** Estado inicial (`PASS` / `FAIL` / `INCOMPLETO` / `MUTANTE SOBREVIVIENTE`), comando ejecutado, salida real de Vitest/Cobertura/Stryker y fecha. Si hubo error, omisión del roteiro o mutantes sobrevivientes, se detalla el **Diagnóstico, Corrección Aplicada (nuevos tests/assertions) y Revalidación**, junto con el commit SHA publicado en `test/david-core-auth-fleet`.

---

## 4. Estado Inicial de Revisión Caso por Caso (Fase 1)

| Orden | ID Oficial (`Casos de Teste — SIF.pdf`) | Módulo | Requisito | Descripción | Estado de Auditoría |
|---|---|---|---|---|---|
| 1 | `TC-CORE-001` | Autenticação | `RF-01` | Login de administrador válido | **Auditado y Aprobado (`PASS` + `100%` Mutación)** |
| 2 | `TC-CORE-002` | Autenticação | `RF-01` | Campos de login vazios | **Auditado y Aprobado (`PASS` + Aislamiento de Campos)** |
| 3 | `TC-CORE-003` | Autenticação | `RF-01` | CPF com comprimento/formato inválido | **Auditado y Aprobado (`PASS` + `100%` Mutación `adminLoginSchema`)** |
| — | *(`TC-CORE-004` no existe; fila 4 es `TC-ADMIN-001`)* | Login UI | `RF-01` | Login seed pelo navegador (Playwright `:3000`) | Fuera de alcance `core-service` |
| 4 | `TC-CORE-005` | RBAC | `RF-02` | Recurso protegido sem JWT | **Auditado y Aprobado (`PASS` + `100%` Mutación Hooks)** |
| 5 | `TC-CORE-006` | Usuários | `RF-01` | Criar usuário com dados válidos | **Auditado y Aprobado (`PASS` + Paso 2 `GET` + `100%` Mutación)** |
| 6 | `TC-CORE-007` | Usuários | `RF-01` | E-mail inválido e campos obrigatórios | **Auditado y Aprobado (`PASS` + `100%` Mutación Contrato)** |
| 7 | `TC-CORE-008` | Veículos | `RF-03` | Registrar veículo válido | **Auditado y Aprobado (`PASS` + `GET /admin/vehicles` + `100%` Mutación)** |
| 8 | `TC-CORE-009` *(PDF: `TC-CORE-09`)* | Veículos | `RF-03` | Placa duplicada | **Auditado y Aprobado (`PASS` + Conteo Invariable + `100%` Mutación)** |
| 9 | `TC-CORE-010` | Veículos | `RF-03` | Enum e tipos inválidos | **Auditado y Aprobado (`PASS` + Aislamiento + `100%` Mutación)** |
| 10 | `TC-CORE-011` | Veículos | `RF-03` | Lista de veículos disponíveis por data | **Auditado y Aprobado (`PASS` + `USER`/`ADMIN` + `100%` Mutación)** |
| 11 | `TC-CORE-012` | Veículos | `RF-03` | Atualizar e excluir veículo | **Auditado y Aprobado (`PASS` + Paso 3 `GET` + `100%` Mutación)** |
| 12 | `TC-CORE-013` | Solicitações | `RF-04` | Criar solicitação própria válida | Pendiente de auditoría individual |
| 13 | `TC-CORE-014` | Solicitações | `RF-04` | Campos obrigatórios vazios | Pendiente de auditoría individual |

---

## 5. Registro Detallado de Revisión Caso por Caso (Fase 1)

### 1. `TC-CORE-001` — Login de administrador válido

#### 1.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-001`
- **Módulo:** Autenticação
- **Requisito / US:** `RF-01` — Administrador e usuário se autenticam e recebem token.
- **Endpoint y Escenario:** `POST /admin/auth` con CPF válido de 11 dígitos (`"00000000000"`) y contraseña válida (`"123456"`), más pruebas complementarias de rechazo ante credenciales inválidas (`401`).
- **Precondiciones (PDF):** Core y seed activos; seed de administrador disponible (aislado en pruebas de componente mediante `app.inject` y mock del repositorio de usuarios con hash real `bcryptjs`).
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 205–294).
- **Código bajo prueba:** `core-service/src/routes/auth-router.ts`, `core-service/src/contracts/users/user-login-schema.ts`, `core-service/src/contracts/auth-response-schema.ts`, `core-service/src/use-cases/authenticate-admin.ts`, `core-service/src/plugins/fastify-jwt-service.ts`.

#### 1.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / ruta** usando instancia real de Fastify (`src/app.ts` + `app.inject`), validación/serialización real con Zod (`fastify-type-provider-zod`), firma/verificación real con `@fastify/jwt` y comparación real de hash con `bcryptjs`. Dependencias externas simuladas con `vi.mock`: `@/domains/users/db/repository` (`findUserAdminByCpf`) y `@/messaging/*` (RabbitMQ). *(No valida conexión real a PostgreSQL).*
- **Categoría:** `happy path` (escenario principal del PDF) + `failure` (escenarios complementarios creados para matar mutantes de seguridad).
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia:** clase válida (CPF admin existente + contraseña correcta) y clases inválidas de dominio (CPF válido inexistente; contraseña incorrecta).
  - **Validación de Contrato (`authResponseSchema`):** verificación de campos expuestos y no exposición de `passwordHash`.
  - **Criterio de Cobertura de Ramas (V8) y Mutación (StrykerJS):** alcanzar `100%` de ramas y `100%` de mutation score en `src/use-cases/authenticate-admin.ts`.

#### 1.3 Resultado Esperado
- **Escenario principal (`Casos de Teste — SIF.pdf`):**
  - `POST /admin/auth` responde `HTTP 200`.
  - El cuerpo JSON contiene `token` JWT tipo `string` no vacío (firmado con `{ id, role: "admin" }`) y el objeto `user` con rol `admin`, sin exponer `passwordHash`.
  - `findUserAdminByCpf("00000000000")` es invocado exactamente una vez.
- **Escenarios de protección contra mutantes (`authenticate-admin.ts`):**
  - Si el CPF de 11 dígitos no existe (`findUserAdminByCpf` devuelve `undefined`) o la contraseña no coincide con el hash `bcryptjs`, el endpoint responde `HTTP 401` con `{ message: "Credenciais inválidas" }` y **no emite `token`**.

#### 1.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` funcional en el happy path / `MUTANTES SOBREVIVIENTES` en calidad (`66.67%` Mutation Score)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-001"`):** `1 passed | 12 skipped (13)` en `242 ms` (`responseTime: 87.24 ms`).
  - **Cobertura V8 inicial de `src/use-cases/authenticate-admin.ts`:** `77.77% Stmts | 50% Branch | 100% Funcs | 100% Lines` (ramas de error en líneas `15–22` sin cubrir).
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/use-cases/authenticate-admin.ts"`):** **`66.67%` total (`80.00%` covered)** — `12` mutantes instrumentados: `8` muertos, **`2` sobrevivientes** y **`2` sin cobertura**:
    1. `[Survived] ConditionalExpression` (`src/use-cases/authenticate-admin.ts:15:6`): `if (!foundUser)` mutado a `if (false)`.
    2. `[NoCoverage] CallExpression` (`src/use-cases/authenticate-admin.ts:15:18`): `throw new InvalidCredentialsError()` eliminado.
    3. `[Survived] ConditionalExpression` (`src/use-cases/authenticate-admin.ts:22:6`): `if (!isPasswordValid)` mutado a `if (false)`.
    4. `[NoCoverage] CallExpression` (`src/use-cases/authenticate-admin.ts:22:24`): `throw new InvalidCredentialsError()` eliminado.

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** La implementación anterior de `TC-CORE-001` probaba únicamente el inicio de sesión exitoso. Si un defecto en producción eliminara la validación de existencia del administrador o la validación de contraseña en `authenticate-admin.ts`, la suite seguiría pasando en verde.
  - **Acción correctiva:** Se añadieron **2 tests complementarios** directamente en `core-service/tests/david-core.spec.ts` bajo `TC-CORE-001` para matar los 4 mutantes críticos:
    1. `TC-CORE-001 (mutación - admin no encontrado)`: simula `findUserAdminByCpf` retornando `undefined` y valida `HTTP 401`, `{ message: "Credenciais inválidas" }` y ausencia de `token`.
    2. `TC-CORE-001 (mutación - contraseña incorrecta)`: simula admin existente con hash de `"123456"` enviando `"senha-incorrecta"` y valida `HTTP 401`, `{ message: "Credenciais inválidas" }` y ausencia de `token`.

- **Revalidación (después de la corrección):** **`PASS` + `100.00%` Mutation Score + `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-001"`):** `3 passed | 12 skipped (15)` en `406 ms` (`responseTime`: `89.77 ms` login válido, `1.19 ms` admin no encontrado, `80.11 ms` contraseña incorrecta).
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/authenticate-admin.ts"`):** **`100.00%` total / `100.00%` covered** — `12` mutantes instrumentados, **`12` muertos**, `0` sobrevivientes, `0` sin cobertura, `0` errores (`40 s`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/authenticate-admin.ts`: subió de `77.77% Stmts / 50% Branch` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`39/39` tests en verde** (`5.46 s`), cobertura global `34.49% Stmts | 25.33% Branch | 24.49% Funcs | 34.53% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 2. `TC-CORE-002` — Campos de login vacíos

#### 2.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-002`
- **Módulo:** Autenticação
- **Requisito / US:** `RF-01` — Validación de credenciales obligatorias en inicio de sesión de administrador.
- **Endpoint y Escenario:** `POST /admin/auth` con `cpf` y `password` vacíos (`""`), complementado con aislamiento individual por campo vacío y cuerpo vacío (`{}`).
- **Precondiciones (PDF):** Core activo (instancia real de Fastify con `app.inject` y validación Zod activa).
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 296–368).
- **Código bajo prueba:** `core-service/src/contracts/users/user-login-schema.ts` (`adminLoginSchema`), `core-service/src/routes/auth-router.ts` (`POST /admin/auth`), `core-service/src/app.ts` (`validatorCompiler` y `setErrorHandler`).

#### 2.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / validación de contrato** sobre Fastify real (`app.inject` + `fastify-type-provider-zod`). Dependencias simuladas con `vi.mock`: `@/domains/users/db/repository` (`findUserAdminByCpf`) para verificar negativamente que no se consulta base de datos, y `@/messaging/*` (RabbitMQ).
- **Categoría:** `failure` / `special-input` (campos vacíos y ausentes).
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia Negativa y Aislamiento de Variables:** verificación conjunta (`cpf: ""`, `password: ""`), aislamiento individual (`solo cpf vacío`, `solo password vacío`) y omisión total de propiedades (`{}`).
  - **Verificación Negativa de Efectos:** comprobar que no se emite `token` y que `findUserAdminByCpf` presenta `0` invocaciones.
  - **Análisis de Mutación (StrykerJS):** auditoría sobre `src/contracts/users/user-login-schema.ts`.

#### 2.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/auth` responde `HTTP 400` en cada entrada vacía o ausente.
  - El cuerpo JSON de error (`body.message`) identifica ambos campos (`cpf` y `password`) cuando ambos faltan o están vacíos, y únicamente el campo defectuoso cuando solo uno está vacío.
  - Ningún `token` es emitido (`body` no contiene la propiedad `token`).
  - `findUserAdminByCpf` nunca es invocado (`not.toHaveBeenCalled()`).

#### 2.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` parcial / Cobertura de aislamiento incompleta**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-002"`):** `1 passed | 14 skipped (15)` en `56 ms` (`responseTime: 7.93 ms`).
  - **Debilidad detectada:** El test original solo enviaba `{ cpf: "", password: "" }` juntos en una única petición; no aislaba si fallaba cada campo por separado ni qué ocurría cuando los campos obligatorios venían ausentes (`{}`).
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/contracts/users/user-login-schema.ts"`):** **`70.00%` total (`7/10` muertos, `3` sobrevivientes)** sobre el archivo completo:
    - Todos los mutantes de campos vacíos/obligatorios de `adminLoginSchema` fueron eliminados (`100%` del alcance propio de `TC-CORE-002`).
    - Los `3` mutantes sobrevivientes del archivo corresponden a ámbitos externos a `TC-CORE-002`:
      1. `[Survived] Regex` (`src/contracts/users/user-login-schema.ts:11:40`): `/^\d+$/` -> `/\d+$/` en `adminLoginSchema.cpf` *(pertenece a formato de CPF — se resolverá explícitamente en **`TC-CORE-003`**)*.
      2. `[Survived] ObjectLiteral` (`src/contracts/users/user-login-schema.ts:3:41`) y `[Survived] MethodExpression` (`src/contracts/users/user-login-schema.ts:5:12`) en `userLoginSchema` (`POST /auth` de conductores, fuera del roteiro `POST /admin/auth` de `TC-CORE-002`).

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** Un único caso combinado `{ cpf: "", password: "" }` no garantiza de forma independiente el mensaje específico por campo ni el rechazo por propiedades faltantes (`undefined`).
  - **Acción correctiva:** Se añadieron **3 tests complementarios de aislamiento** en `core-service/tests/david-core.spec.ts` bajo `TC-CORE-002`:
    1. `TC-CORE-002 (aislamiento - solo cpf vacío)`: `{ cpf: "", password: "123456" }` -> `400`, reporta `cpf` y no `password`.
    2. `TC-CORE-002 (aislamiento - solo password vacío)`: `{ cpf: "00000000000", password: "" }` -> `400`, reporta `password` y no `cpf`.
    3. `TC-CORE-002 (aislamiento - campos obligatorios ausentes)`: `{}` -> `400`, reporta `cpf` y `password`.

- **Revalidación (después de la corrección):** **`PASS` (`4/4` tests en `TC-CORE-002`)**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-002"`):** `4 passed | 14 skipped (18)` en `62 ms` (`responseTime`: `6.80 ms` ambos vacíos, `0.97 ms` solo `cpf`, `0.71 ms` solo `password`, `0.57 ms` cuerpo `{}`).
  - **StrykerJS (`npx.cmd stryker run -m "src/contracts/users/user-login-schema.ts"`):** `70.00%` (`7/10` muertos, `3` sobrevivientes documentados arriba; `0` sobrevivientes de campos vacíos en `adminLoginSchema`; el mutante de regex en línea 11 queda trazado para eliminarse en `TC-CORE-003`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/contracts/users/user-login-schema.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`42/42` tests en verde** (`6.53 s`), cobertura global `34.49% Stmts | 25.33% Branch | 24.49% Funcs | 34.53% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 3. `TC-CORE-003` — CPF con longitud o formato inválido

#### 3.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-003`
- **Módulo:** Autenticação
- **Requisito / US:** `RF-01` — Validación de longitud exacta (11 dígitos) y formato estrictamente numérico de CPF en el login administrativo.
- **Endpoint y Escenario:** `POST /admin/auth` con CPF de `10` y `12` caracteres (fronteras de longitud) y múltiples variantes con caracteres no numéricos (al final, al inicio, en el medio, con espacios y con puntuación `000.000.000-00`).
- **Precondiciones (PDF):** Core activo (instancia real de Fastify con `app.inject` y validación Zod).
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 370–418).
- **Código bajo prueba:** `core-service/src/contracts/users/user-login-schema.ts` (`adminLoginSchema.cpf`), `core-service/src/routes/auth-router.ts` (`POST /admin/auth`).

#### 3.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / validación de contrato** sobre Fastify real (`app.inject` + `fastify-type-provider-zod`). Dependencias simuladas con `vi.mock`: `@/domains/users/db/repository` (`findUserAdminByCpf`) para verificación negativa y `@/messaging/*` (RabbitMQ).
- **Categoría:** `boundary` + `special-input` + `failure`.
- **Criterios y Técnicas Aplicadas:**
  - **Análisis de Valores Límite (BVA):** `10` dígitos (`min - 1`) y `12` dígitos (`max + 1`) respecto al límite exacto `11`.
  - **Partición de Equivalencia de Formato (Regex `/^\d+$/`):** caracteres no numéricos en posiciones de borde (inicio `^`, final `$`, intermedio), espacios en blanco y puntuación (`000.000.000-00`).
  - **Pruebas Parametrizadas (`it.each`):** ejecución y reporte independiente por cada clase/frontera.
  - **Análisis de Mutación (StrykerJS):** verificación de eliminación de mutantes en `adminLoginSchema` (`src/contracts/users/user-login-schema.ts`).

#### 3.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/auth` responde `HTTP 400` en cada intento con CPF de longitud o formato inválido.
  - El cuerpo JSON reporta el error asociado al campo `cpf` y **ningún `token` es emitido**.
  - `findUserAdminByCpf` presenta `0` invocaciones (`not.toHaveBeenCalled()`), confirmando rechazo previo en capa de contrato.

#### 3.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Trazabilidad de Incidente Histórico (Commit `b2d6811`):**
  - *Nota de auditoría:* Originalmente en el código base, `adminLoginSchema.cpf` (`src/contracts/users/user-login-schema.ts:11`) definía únicamente `z.string().min(11).max(11)` sin validación numérica, por lo que una cadena de 11 caracteres con letras (ej. `"1234567890a"`) superaba el esquema y llegaba a base de datos devolviendo `HTTP 401` en vez de `400`. El agente anterior añadió `.regex(/^\d+$/)` en `b2d6811` pero omitió registrar el fallo inicial en su relatoría; aquí queda trazado formalmente.
- **Evaluación Inicial (antes de corregir en Fase 1):** **`PASS` funcional / `MUTANTE SOBREVIVIENTE` en Regex (`70.00%` en `user-login-schema.ts`)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-003"`):** `1 passed | 17 skipped (18)` en `61 ms` (`responseTime`: `7.98 ms`, `0.93 ms`, `0.95 ms`, `0.45 ms`), agrupando 4 entradas en un bucle `for` dentro de un único `it()`.
  - **Mutante sobreviviente detectado por StrykerJS (`src/contracts/users/user-login-schema.ts:11:40`):**
    - `[Survived] Regex`: `cpf: z.string().min(11).max(11).regex(/^\d+$/)` mutado a `regex(/\d+$/)`.
    - **Causa raíz:** La única entrada no numérica de 11 caracteres era `"1234567890a"` (letra al **final**). Al eliminar el ancla de inicio `^`, `/\d+$/` seguía rechazando `"1234567890a"` (porque termina en letra), pero habría aceptado silenciosamente `"a1234567890"` (letra al **inicio**).

- **Diagnóstico y Corrección Aplicada:**
  - Se refactorizó `TC-CORE-003` en `core-service/tests/david-core.spec.ts` reemplazando el bucle `for` por **`it.each` con 7 casos granulares** e independientes:
    1. `"1234567890"` (frontera inferior: `10` dígitos).
    2. `"123456789012"` (frontera superior: `12` dígitos).
    3. `"1234567890a"` (`11` chars, no numérico al final — mata mutación del ancla `$`).
    4. `"a1234567890"` (`11` chars, no numérico al inicio — **mata el mutante sobreviviente `/^\d+$/ -> /\d+$/`**).
    5. `"12345a67890"` (`11` chars, no numérico en el medio).
    6. `"12345 67890"` (`11` chars, espacio interno).
    7. `"000.000.000-00"` (formato con puntuación no numérica).

- **Revalidación (después de la corrección):** **`PASS` (`7/7` tests) + `100%` Mutación en `adminLoginSchema`**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-003"`):** `7 passed | 17 skipped (24)` en `66 ms` (`responseTime`: `6.91 ms`, `0.97 ms`, `0.73 ms`, `0.44 ms`, `0.93 ms`, `0.58 ms`, `0.45 ms`).
  - **StrykerJS (`npx.cmd stryker run -m "src/contracts/users/user-login-schema.ts"`):** subió de `70.00%` (`7/10`) a **`80.00%` (`8/10` muertos, `2` sobrevivientes)** en `38 s`:
    - El mutante `[Survived] Regex` de la línea 11 fue **matado** por `"a1234567890"`, logrando **`100%` (`8/8`) de los mutantes de `adminLoginSchema`** eliminados.
    - Los únicos `2` mutantes restantes del archivo pertenecen a `userLoginSchema` (`POST /auth` de conductores, líneas 3 y 5, fuera del alcance de `TC-CORE-003`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/contracts/users/user-login-schema.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`48/48` tests en verde** (`5.47 s`), cobertura global `34.49% Stmts | 25.33% Branch | 24.49% Funcs | 34.53% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 4. `TC-CORE-005` — Recurso protegido sin JWT (y protección RBAC)

#### 4.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-005` *(Nota: no existe `TC-CORE-004` en el PDF oficial; la fila 4 corresponde a `TC-ADMIN-001` en `admin-app`/Playwright).*
- **Módulo:** RBAC
- **Requisito / US:** `RF-02` — RBAC diferencia `ADMIN` y `USER` en recursos `/admin/*` y exige JWT en rutas protegidas.
- **Endpoint y Escenario:** `GET /vehicles` y `GET /admin/vehicles` sin cabecera `Authorization`, ampliado con JWT malformado, JWT expirado y protección RBAC del hook `authorize` (rol `driver` en ruta `/admin/vehicles` y ausencia de `request.user`).
- **Precondiciones (PDF):** Core activo (instancia real de Fastify con hooks `verifyJwt` y `authorize`).
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 420–509).
- **Código bajo prueba:** `core-service/src/hooks/verify-jwt.ts`, `core-service/src/hooks/authorize.ts`, `core-service/src/routes/vehicle-router.ts`.

#### 4.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / hooks de seguridad** (`app.inject` + `@fastify/jwt` + `verifyJwt` + `authorize` reales) combinada con una prueba **unitaria directa** del guard `authorize([USER_ROLES[1]])`. Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`fetchAll`) para verificación negativa y `@/messaging/*` (RabbitMQ).
- **Categoría:** `failure` + `security / RBAC`.
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia de Seguridad:** sin token, token malformado, token expirado (`401`), token válido con rol insuficiente (`403`) y defensa en profundidad sin `request.user` (`401`).
  - **Verificación Negativa de Acceso a Datos:** `fetchAllVehicles` nunca es invocado (`0` llamadas).
  - **Cobertura de Ramas V8 y Mutación (StrykerJS):** alcanzar `100%` de cobertura y `100%` de mutation score en ambos hooks (`verify-jwt.ts` y `authorize.ts`).

#### 4.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `GET /vehicles` y `GET /admin/vehicles` sin cabecera `Authorization` (así como con token inválido o expirado) responden `HTTP 401` con `{ error: "Token inválido ou expirado" }`.
  - El recurso no es consultado ni modificado (`fetchAllVehicles` no invocado).
- Complementario de seguridad RBAC (`RF-02` / `authorize.ts`):
  - `GET /admin/vehicles` con JWT válido de rol `driver` responde `HTTP 403` con `{ error: "Sem permissão" }` sin consultar el repositorio.
  - Invocar `authorize` sin `request.user` responde `HTTP 401` con `{ error: "Não autenticado" }`.

#### 4.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` en `verify-jwt.ts` / `MUTANTES SOBREVIVIENTES CRÍTICOS` en `authorize.ts` (`30.77%` Mutation Score)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-005"`):** `1 passed | 23 skipped (24)` en `56 ms` (solo probaba ausencia total de header en un bucle `for`).
  - **Cobertura V8 inicial de `src/hooks/`:** `verify-jwt.ts` al `100%`, pero `authorize.ts` al **`66.66% Stmts | 50% Branch`** (líneas `9` y `13` sin cubrir).
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/hooks/verify-jwt.ts,src/hooks/authorize.ts"`):** **`50.00%` combinado** (`verify-jwt.ts`: `100.00%`, `5/5`; **`authorize.ts`: `30.77%`**, `4` muertos, **`3` sobrevivientes**, **`6` sin cobertura**, `1` error de arranque):
    - Sobrevivía incluso vaciar el cuerpo completo del hook `authorize` (`async () => {}`, línea 5) y reemplazar `if (!allowedRoles.includes(user.role))` por `if (false)` (línea 12), además de las ramas `403` (líneas 12–13) y `401` defensivo sin `request.user` (líneas 8–9) sin cobertura.

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** Ningún test de la suite probaba rechazo por rol insuficiente (`403`) ni la rama defensiva sin `request.user` (`401`) en `authorize.ts`, ni validaba tokens malformados/expirados en `verifyJwt`.
  - **Acción correctiva:** Se amplió `TC-CORE-005` en `core-service/tests/david-core.spec.ts` a **6 tests independientes**:
    1. `it.each` para `GET /vehicles` y `GET /admin/vehicles` sin `Authorization` (`401`).
    2. `GET /admin/vehicles` con `Bearer` malformado (`401`).
    3. `GET /admin/vehicles` con JWT expirado (`expiresIn: -10`, `401`).
    4. `GET /admin/vehicles` con JWT válido de rol `driver` (`403` `{ error: "Sem permissão" }`, mata 8 mutantes en `authorize.ts`).
    5. Prueba unitaria de `authorize([USER_ROLES[1]])` sin `request.user` (`401` `{ error: "Não autenticado" }`, mata 4 mutantes en `authorize.ts`).

- **Revalidación (después de la corrección):** **`PASS` (`6/6` tests) + `100.00%` Mutation Score y `100%` Cobertura en ambos hooks**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-005"`):** `6 passed | 23 skipped (29)` en `63 ms`.
  - **StrykerJS (`npx.cmd stryker run -m "src/hooks/verify-jwt.ts,src/hooks/authorize.ts"`):** subió de `50.00%` a **`100.00%` total / `100.00%` covered** (`50 s`):
    - `verify-jwt.ts`: **`100.00%`** (`5` muertos, `0` sobrevivientes, `0` sin cobertura, `0` errores).
    - `authorize.ts`: subió de `30.77%` a **`100.00%`** (`13` muertos, `0` sobrevivientes, `0` sin cobertura; `1` mutante marcado como error de arranque de Fastify al mutar la fábrica del `preHandler`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/hooks/verify-jwt.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - `src/hooks/authorize.ts`: subió de `66.66% Stmts / 50% Branch` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`53/53` tests en verde** (`5.58 s`), cobertura global `34.65% Stmts | 25.72% Branch | 24.49% Funcs | 34.70% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 5. `TC-CORE-006` — Crear usuario con datos válidos

#### 5.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-006`
- **Módulo:** Usuários
- **Requisito / US:** `RF-01` — Creación de usuario administrativo/conductor con unicidad de e-mail/CPF, contraseña hasheada no reversible y consulta por ID.
- **Endpoint y Escenario:**
  1. `POST /admin/users` con nombre, email, CPF, rol y contraseña válidos (JWT `admin`).
  2. `GET /admin/users/:id` con el ID devuelto en el Paso 1.
  - Complementado con colisiones de unicidad (`CPF` duplicado, `email` duplicado) y consulta de ID inexistente (`404`).
- **Precondiciones (PDF):** Admin JWT; e-mail y CPF no duplicados.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 511–663).
- **Código bajo prueba:** `core-service/src/routes/user-router.ts` (`POST /admin/users`, `GET /admin/users/:id`), `core-service/src/use-cases/users/create-user.ts`, `core-service/src/use-cases/users/fetch-user-by-id.ts`.

#### 5.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` + `bcryptjs` reales). Dependencias simuladas con `vi.mock`: `@/domains/users/db/repository` (`findUserByEmail`, `findUserByCpf`, `insertUser`, `findUserById`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ). *(No escribe físicamente en PostgreSQL; simula el almacenamiento en memoria dentro del test para enlazar `POST` y `GET`).*
- **Categoría:** `happy path` (creación + consulta por ID) + `failure` (duplicidad de CPF/email y consulta `404` para mutación).
- **Criterios y Técnicas Aplicadas:**
  - **Verificación de Flujo Completo del Roteiro (`POST` → `GET`):** cumplimiento estricto de los 2 pasos de `Casos de Teste — SIF.pdf`.
  - **Verificación Criptográfica (`bcryptjs`):** validación de que `insertUser` recibe un hash irreversible (`bcrypt.compare === true`, distinto del texto plano) y de que ni `POST` ni `GET` exponen `password` ni `passwordHash`.
  - **Cobertura de Ramas V8 y Mutación (StrykerJS):** alcanzar `100%` en `create-user.ts` y `fetch-user-by-id.ts` (incorporando también `fetch-user-by-id.ts` a `core-service/stryker.config.mjs`).

#### 5.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - **Paso 1 (`POST /admin/users`):** `HTTP 201`; la respuesta contiene `id` y los datos del usuario creado sin `password`/`passwordHash`; el payload enviado a `insertUser` contiene `passwordHash` no reversible (`bcryptjs`); se invoca `createAuditLog` con `USER.CREATED`.
  - **Paso 2 (`GET /admin/users/:id`):** `HTTP 200`; devuelve el usuario creado correspondiente al `id`, sin exponer `passwordHash`.
- Escenarios complementarios de unicidad y error:
  - CPF duplicado → `HTTP 400` (`{ message: "CPF já está em uso" }`), sin invocar `insertUser` ni `createAuditLog`.
  - E-mail duplicado → `HTTP 400` (`{ message: "E-mail já está em uso" }`), sin invocar `insertUser` ni `createAuditLog`.
  - `GET /admin/users/:id` inexistente → `HTTP 404` (`{ message: "Usuário não encontrado" }`).

#### 5.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`INCOMPLETO` frente al PDF + `MUTANTES SOBREVIVIENTES / SIN COBERTURA` (`52.94%` combinado)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-006"`):** `1 passed | 28 skipped (29)` en `240 ms` (`responseTime: 100.17 ms`), **pero omitía el Paso 2 (`GET /admin/users/:id`)** del roteiro oficial.
  - **Cobertura V8 inicial:** `create-user.ts` al `88.88% Stmts | 83.33% Branch` (línea 26 sin cubrir) y **`fetch-user-by-id.ts` al `0% Stmts | 0% Branch | 0% Funcs | 0% Lines`**.
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/use-cases/users/create-user.ts,src/use-cases/users/fetch-user-by-id.ts"`):** **`52.94%` total (`9/17` muertos, `1` sobreviviente, `7` sin cobertura)**:
    - `create-user.ts`: `81.82%` (`9/11`) — sobrevivía `[Survived] ConditionalExpression` y `[NoCoverage] CallExpression` en la línea 26 (`if (existingCpf) throw new CpfAlreadyInUseError()`).
    - `fetch-user-by-id.ts`: **`0.00%`** (`0/6`, los `6` mutantes sin cobertura).

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** El test previo no implementó el Paso 2 (`GET /admin/users/:id`) del PDF oficial ni probó rechazo por CPF duplicado o usuario inexistente.
  - **Acción correctiva:**
    1. Se completó `TC-CORE-006` en `core-service/tests/david-core.spec.ts` enlazando el registro devuelto por `insertUser` con `findUserById` y ejecutando el **Paso 2 (`GET /admin/users/:id` → `200 OK`)** con verificación de campos y ocultamiento de `passwordHash`.
    2. Se añadieron **3 tests complementarios** para matar el `100%` de mutantes: `CPF duplicado` (`400`), `email duplicado` (`400`) y `GET /admin/users/:id inexistente` (`404`).
    3. Se incorporó `src/use-cases/users/fetch-user-by-id.ts` a la lista `mutate` de `core-service/stryker.config.mjs`.

- **Revalidación (después de la corrección):** **`PASS` (`4/4` tests) + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-006"`):** `4 passed | 28 skipped (32)` en `248 ms` (`responseTime`: `98.01 ms` `POST 201`, `0.85 ms` `GET 200`, `2.28 ms` CPF duplicado `400`, `0.98 ms` email duplicado `400`, `0.47 ms` `GET 404`).
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/users/create-user.ts,src/use-cases/users/fetch-user-by-id.ts"`):** subió de `52.94%` a **`100.00%` total / `100.00%` covered** (`45 s`):
    - `create-user.ts`: **`100.00%`** (`11/11` muertos, `0` sobrevivientes, `0` sin cobertura).
    - `fetch-user-by-id.ts`: subió de `0.00%` a **`100.00%`** (`6/6` muertos, `0` sobrevivientes, `0` sin cobertura).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/users/create-user.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - `src/use-cases/users/fetch-user-by-id.ts`: subió de `0%` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`56/56` tests en verde** (`5.82 s`), cobertura global `35.21% Stmts | 26.30% Branch | 25.16% Funcs | 35.19% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 6. `TC-CORE-007` — E-mail inválido y campos obligatorios vacíos

#### 6.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-007`
- **Módulo:** Usuários
- **Requisito / US:** `RF-01` — Validación de campos obligatorios, formato de e-mail y límites de contrato en el alta de usuarios.
- **Endpoint y Escenario:**
  1. `POST /admin/users` con `name`, `email` y `password` vacíos (`""`).
  2. `POST /admin/users` con `email` en formato inválido (`"correo-invalido-sin-arroba"`).
  - Complementado con cuerpo vacío (`{}`) y fronteras de longitud de `cpf` y `cnh` (`10` y `12` caracteres).
- **Precondiciones (PDF):** Admin JWT.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 665–777).
- **Código bajo prueba:** `core-service/src/contracts/users/create-user-schema.ts`, `core-service/src/routes/user-router.ts` (`POST /admin/users`).

#### 6.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / validación de contrato** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` reales). Dependencias simuladas con `vi.mock`: `@/domains/users/db/repository` (`findUserByEmail`, `findUserByCpf`, `insertUser`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ).
- **Categoría:** `failure` + `special-input` + `boundary`.
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia Negativa:** campos obligatorios vacíos (`""`), ausentes (`{}`) y formato de e-mail inválido.
  - **Análisis de Valores Límite (BVA):** fronteras `min - 1` (`10`) y `max + 1` (`12`) para `cpf` y `cnh`.
  - **Verificación Negativa Completa:** comprobar `0` llamadas a `findUserByEmail`, `findUserByCpf`, `insertUser` y `createAuditLog`.
  - **Análisis de Mutación (StrykerJS):** alcanzar `100%` en `src/contracts/users/create-user-schema.ts`.

#### 6.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/users` responde `HTTP 400` en cada petición inválida.
  - `body.message` identifica cada campo inválido (`name`, `email`, `password` en Paso 1; `email` en Paso 2; todos los obligatorios en `{}`; `cpf`/`cnh` en límites de longitud).
  - Ninguna fila nueva es insertada ni auditada, ni se consultan `findUserByEmail`/`findUserByCpf`.

#### 6.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Trazabilidad de Incidente Histórico (Commit `b2d6811`):**
  - *Nota de auditoría:* Originalmente en el código base, `createUserSchema` (`src/contracts/users/create-user-schema.ts:5,7`) definía `name: z.string()` y `password: z.string()` sin `.min(1)`, permitiendo cadenas vacías `""`. El agente anterior añadió `.min(1)` en `b2d6811` sin documentar el fallo inicial; queda trazado formalmente aquí.
- **Evaluación Inicial (antes de corregir en Fase 1):** **`PASS` parcial / `4 MUTANTES SOBREVIVIENTES` (`55.56%` en `create-user-schema.ts`)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-007"`):** `1 passed | 31 skipped (32)` en `341 ms` (`responseTime`: `18.53 ms` campos vacíos, `4.82 ms` email inválido). No verificaba `findUserByEmail`/`findUserByCpf` ni campos ausentes `{}`.
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/contracts/users/create-user-schema.ts"`):** **`55.56%` (`5/9` muertos, `4` sobrevivientes)**:
    1. `[Survived] MethodExpression` (línea 8): `cpf: z.string().min(11).max(11)` → `.min(11).min(11)`.
    2. `[Survived] MethodExpression` (línea 8): `cpf: z.string().min(11).max(11)` → `.max(11).max(11)`.
    3. `[Survived] MethodExpression` (línea 9): `cnh: z.string().min(11).max(11).optional()` → `.min(11).min(11).optional()`.
    4. `[Survived] MethodExpression` (línea 9): `cnh: z.string().min(11).max(11).optional()` → `.max(11).max(11).optional()`.

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** Ningún test de la suite probaba longitudes fuera de límite (`10` y `12` caracteres) para `cpf` ni para el campo opcional `cnh` al crear usuarios.
  - **Acción correctiva:** En `core-service/tests/david-core.spec.ts` bajo `TC-CORE-007`:
    1. Se añadieron assertions negativas de `findUserByEmail` y `findUserByCpf` (`not.toHaveBeenCalled()`).
    2. Se añadió el caso `TC-CORE-007 (campos obligatorios ausentes)` enviando `{}` (`400` identificando `name`, `email`, `password`, `cpf` y `phone`).
    3. Se añadió un bloque **`it.each` de 4 pruebas de frontera** para `cpf` (`10` y `12` chars) y `cnh` (`10` y `12` chars), matando los 4 mutantes sobrevivientes.

- **Revalidación (después de la corrección):** **`PASS` (`6/6` tests) + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-007"`):** `6 passed | 31 skipped (37)` en `96 ms` (`responseTime`: `9.22 ms`, `1.13 ms`, `1.87 ms`, `0.75 ms`, `0.77 ms`, `0.83 ms`, `0.60 ms`).
  - **StrykerJS (`npx.cmd stryker run -m "src/contracts/users/create-user-schema.ts"`):** subió de `55.56%` (`5/9`) a **`100.00%` total / `100.00%` covered** (**`9/9` muertos**, `0` sobrevivientes, `0` sin cobertura, `0` errores; `38 s`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/contracts/users/create-user-schema.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`61/61` tests en verde** (`7.48 s`), cobertura global `35.21% Stmts | 26.30% Branch | 25.16% Funcs | 35.19% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 7. `TC-CORE-008` — Registrar vehículo válido

#### 7.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-008`
- **Módulo:** Veículos
- **Requisito / US:** `RF-03` — O veículo tem placa, modelo, ano, odómetro, status e tipo; placa duplicada é rejeitada.
- **Endpoint y Escenario:** `POST /admin/vehicles` con datos válidos (`plate: "ABC1D23"`, `model: "Fiat Toro"`, `year: 2024`, `odometer: 1200`, `imageUrl: null`, `status: "AVAILABLE"`, `type: "CAR"`), seguido de verificación de visibilidad en `GET /admin/vehicles`.
- **Precondiciones (PDF):** Admin JWT; placa libre.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 781–863).
- **Código bajo prueba:** `core-service/src/routes/vehicle-router.ts` (`POST /admin/vehicles`, `GET /admin/vehicles`), `core-service/src/use-cases/vehicles/register-vehicle.ts`, `core-service/src/use-cases/vehicles/fetch-vehicles.ts`.

#### 7.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` reales). Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`findByPlate`, `insertVehicle`, `fetchAll`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ). *(La visibilidad entre `POST` y `GET` se enlaza mediante un arreglo en memoria del test, no contra PostgreSQL real).*
- **Categoría:** `happy path`.
- **Criterios y Técnicas Aplicadas:**
  - **Validación de Contrato (`vehicleRequestSchema` / `vehicleResponseSchema`):** verificación exacta de tipos y propiedades en entrada y salida.
  - **Verificación de Flujo Completo (`POST` → `GET /admin/vehicles`):** cumplimiento del resultado esperado de `Casos de Teste — SIF.pdf` (*"veículo persistido e visível em GET `/admin/vehicles`"*).
  - **Cobertura V8 y Mutación (StrykerJS):** alcanzar `100%` en `register-vehicle.ts` y `fetch-vehicles.ts` (incorporando `fetch-vehicles.ts` a `core-service/stryker.config.mjs`).

#### 7.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/vehicles` responde `HTTP 201` con los datos del vehículo creado y su `id`; invoca `findByPlate("ABC1D23")`, `insertVehicle(...)` y `createAuditLog` (`VEHICLE.CREATED`).
  - `GET /admin/vehicles` responde `HTTP 200` incluyendo el vehículo recién registrado en el listado.

#### 7.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`INCOMPLETO` frente al PDF + `fetch-vehicles.ts` sin cobertura (`0.00%` Mutación)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-008"`):** `1 passed | 36 skipped (37)` en `84 ms` (`responseTime: 13.16 ms`), pero **omitía la comprobación en `GET /admin/vehicles`**.
  - **Cobertura V8 inicial:** `register-vehicle.ts` al `100%`, pero **`fetch-vehicles.ts` al `0% Stmts | 0% Funcs | 0% Lines`**.
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/use-cases/vehicles/register-vehicle.ts,src/use-cases/vehicles/fetch-vehicles.ts"`):** **`75.00%` combinado (`6/8` muertos, `2` sin cobertura)**:
    - `register-vehicle.ts`: `100.00%` (`6/6`).
    - `fetch-vehicles.ts`: **`0.00%`** (`0/2`, ambos mutantes en `BlockStatement` y `ArrowFunction` sin cobertura).

- **Diagnóstico y Corrección Aplicada:**
  - **Causa raíz:** El test previo no verificaba la visibilidad del vehículo en `GET /admin/vehicles`, dejando incumplida parte del resultado esperado del PDF y sin cobertura el caso de uso `fetchVehicles()`.
  - **Acción correctiva:**
    1. Se amplió `TC-CORE-008` en `core-service/tests/david-core.spec.ts` enlazando `insertVehicle` con un arreglo `storedVehicles` retornado por `fetchAllVehicles` y ejecutando `GET /admin/vehicles` (`HTTP 200`, `length: 1`, atributos exactos del vehículo registrado).
    2. Se añadió `src/use-cases/vehicles/fetch-vehicles.ts` a la lista `mutate` de `core-service/stryker.config.mjs`.

- **Revalidación (después de la corrección):** **`PASS` + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-008"`):** `1 passed | 36 skipped (37)` en `95 ms` (`responseTime`: `12.29 ms` `POST 201`, `1.07 ms` `GET 200`).
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/vehicles/register-vehicle.ts,src/use-cases/vehicles/fetch-vehicles.ts"`):** subió de `75.00%` a **`100.00%` total / `100.00%` covered** (`20 s`):
    - `register-vehicle.ts`: **`100.00%`** (`6/6` muertos).
    - `fetch-vehicles.ts`: subió de `0.00%` a **`100.00%`** (`2/2` muertos, `0` sobrevivientes, `0` sin cobertura).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/vehicles/register-vehicle.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - `src/use-cases/vehicles/fetch-vehicles.ts`: subió de `0%` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - `src/routes/vehicle-router.ts`: subió de `80.95%` a **`90.47%`**.
    - Suite completa: `2 passed (2)` archivos, **`61/61` tests en verde** (`5.59 s`), cobertura global `35.62% Stmts | 26.30% Branch | 26.17% Funcs | 35.52% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 8. `TC-CORE-009` *(PDF: `TC-CORE-09`)* — Registro de vehículo con placa duplicada

#### 8.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-09` *(normalizado en la suite como `TC-CORE-009` por coherencia numérica).*
- **Módulo:** Veículos
- **Requisito / US:** `RF-03` — Placa duplicada es rechazada al registrar vehículos.
- **Endpoint y Escenario:** `POST /admin/vehicles` con placa ya existente (`"ABC1D23"`), verificando el conteo de vehículos en `GET /admin/vehicles` antes y después del intento.
- **Precondiciones (PDF):** Vehículo seed con la misma placa; Admin JWT.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 865–913).
- **Código bajo prueba:** `core-service/src/use-cases/vehicles/register-vehicle.ts`, `core-service/src/domains/vehicles/errors.ts` (`PlateAlreadyRegisteredError`), `core-service/src/routes/vehicle-router.ts`.

#### 8.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / regla de negocio** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` + `setErrorHandler` reales). Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`findByPlate`, `insertVehicle`, `fetchAll`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ). *(El conteo de vehículos se verifica mediante estado en memoria del mock, no contra PostgreSQL real).*
- **Categoría:** `failure` (colisión de unicidad de dominio).
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia Negativa (Unicidad de Placa):** intento de registro con placa ya presente en el repositorio simulado.
  - **Validación de Contrato de Error:** verificación exacta del código HTTP definido en `PlateAlreadyRegisteredError` (`400`, dentro del rango `409/400` contemplado por el PDF) y del mensaje `"A placa desse veículo já foi registrada"`.
  - **Verificación Negativa e Invariante de Conteo:** comprobar que `insertVehicle` y `createAuditLog` no son llamados y que `GET /admin/vehicles` conserva exactamente el mismo conteo (`1` antes y `1` después).

#### 8.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/vehicles` responde `HTTP 400` *(conforme al contrato de `PlateAlreadyRegisteredError` en `src/domains/vehicles/errors.ts:6`, dentro del `409/400` especificado)* con `{ message: "A placa desse veículo já foi registrada" }`.
  - `findByPlate("ABC1D23")` es invocado; `insertVehicle` y `createAuditLog` presentan `0` invocaciones.
  - La cantidad de vehículos en `GET /admin/vehicles` **no aumenta** (`1` antes y `1` después).

#### 8.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` parcial / Incompleto en verificación de conteo y con aserción redundante**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-009"`):** `1 passed | 36 skipped (37)` en `90 ms` (`responseTime: 10.70 ms`).
  - **Debilidades detectadas:**
    1. No comprobaba la invariante del PDF *"a contagem de veículos não aumenta"* mediante `GET /admin/vehicles`.
    2. No validaba que `findByPlate` recibiera `"ABC1D23"`.
    3. Tenía una aserción redundante (`expect([400, 409]).toContain(response.statusCode)` seguida de `expect(response.statusCode).toBe(400)`).
    4. No dejaba explícita la correspondencia con el typo `TC-CORE-09` del PDF.
  - **StrykerJS inicial (`src/use-cases/vehicles/register-vehicle.ts`):** ya se encontraba en **`100.00%`** (`6/6` muertos, `0` sobrevivientes).

- **Diagnóstico y Corrección Aplicada:**
  - Se actualizó `TC-CORE-009` en `core-service/tests/david-core.spec.ts` para:
    1. Inicializar un listado en memoria `storedVehicles = [makeVehicle()]` y comprobar el conteo inicial vía `GET /admin/vehicles` (`1`).
    2. Enviar `POST /admin/vehicles` con placa `"ABC1D23"`, validando `HTTP 400`, `findByPlate("ABC1D23")`, mensaje exacto y `0` llamadas a `insertVehicle`/`createAuditLog`.
    3. Comprobar nuevamente `GET /admin/vehicles` confirmando que la longitud permanece en `1`.
    4. Eliminar la aserción redundante y documentar explícitamente el alias `PDF: TC-CORE-09`.

- **Revalidación (después de la corrección):** **`PASS` + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-009"`):** `1 passed | 36 skipped (37)` en `105 ms` (`responseTime`: `8.87 ms` `GET` inicial, `4.42 ms` `POST 400`, `0.61 ms` `GET` final).
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/vehicles/register-vehicle.ts"`):** **`100.00%` total / `100.00%` covered** (`6/6` muertos, `0` sobrevivientes, `0` sin cobertura, `0` errores; `17 s`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/vehicles/register-vehicle.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`61/61` tests en verde** (`6.26 s`), cobertura global `35.62% Stmts | 26.30% Branch | 26.17% Funcs | 35.52% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 9. `TC-CORE-010` — Enums y tipos de datos inválidos

#### 9.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-010`
- **Módulo:** Veículos
- **Requisito / US:** `RF-03` — Validación estricta de tipos numéricos (`year`, `odometer`) y enumeraciones (`status`, `type`) en el alta de vehículos.
- **Endpoint y Escenario:** `POST /admin/vehicles` con `status`/`type` fuera de enum y `year`/`odometer` no numéricos (prueba combinada del PDF + aislamiento individual por campo, incluyendo strings numéricos `"2024"`/`"1200"` para verificar ausencia de coerción).
- **Precondiciones (PDF):** Admin JWT.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 915–989).
- **Código bajo prueba:** `core-service/src/contracts/vehicles/register-vehicle-request-schema.ts`, `core-service/src/routes/vehicle-router.ts` (`POST /admin/vehicles`).

#### 9.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / validación de contrato** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` reales). Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`findByPlate`, `insertVehicle`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ).
- **Categoría:** `failure` + `special-input`.
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia Negativa y Aislamiento de Variables:** verificación combinada de los 4 campos inválidos más bloque `it.each` de 4 pruebas individuales (una por cada campo) verificando tipado estricto (`z.number()` sin coerción de strings numéricos) y validez de enum (`VEHICLE_STATUSES`, `VEHICLE_TYPES`).
  - **Verificación Negativa de Persistencia:** confirmar `0` invocaciones a `findByPlate`, `insertVehicle` y `createAuditLog`.
  - **Análisis de Mutación (StrykerJS):** validación sobre `src/contracts/vehicles/register-vehicle-request-schema.ts`.

#### 9.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `POST /admin/vehicles` responde `HTTP 400` en el caso combinado y en cada caso aislado.
  - `body.message` identifica explícitamente los campos inválidos (`year`, `odometer`, `status`, `type`).
  - El vehículo **no es persistido** (`findByPlate`, `insertVehicle` y `createAuditLog` con `0` llamadas).

#### 9.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` funcional / Falta de aislamiento individual por campo**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-010"`):** `1 passed | 36 skipped (37)` en `235 ms` (`responseTime: 20.22 ms`).
  - **Debilidad detectada:** Los 4 campos inválidos se enviaban únicamente juntos en una sola petición y solo con textos alfabéticos (`"dos-mil-veinticuatro"`), sin aislar cada regla ni validar que strings numéricos (`"2024"`, `"1200"`) no sean coercidos silenciosamente.
  - **StrykerJS inicial (`src/contracts/vehicles/register-vehicle-request-schema.ts`):** `100.00%` (`1/1` muerto, `0` sobrevivientes; `33 s`).

- **Diagnóstico y Corrección Aplicada:**
  - Se conservó la prueba combinada conforme al roteiro del PDF y se añadió en `core-service/tests/david-core.spec.ts` un bloque **`it.each` con 4 casos aislados**:
    1. `year: "2024"` (string numérico no coercible → `400`, identifica `year`).
    2. `odometer: "1200"` (string numérico no coercible → `400`, identifica `odometer`).
    3. `status: "STATUS_INEXISTENTE"` (fuera de enum → `400`, identifica `status`).
    4. `type: "NAVE_ESPACIAL"` (fuera de enum → `400`, identifica `type`).

- **Revalidación (después de la corrección):** **`PASS` (`5/5` tests) + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-010"`):** `5 passed | 36 skipped (41)` en `237 ms` (`responseTime`: `21.66 ms` combinado, `3.10 ms` `year`, `2.36 ms` `odometer`, `2.71 ms` `status`, `3.32 ms` `type`).
  - **StrykerJS (`npx.cmd stryker run -m "src/contracts/vehicles/register-vehicle-request-schema.ts"`):** **`100.00%` total / `100.00%` covered** (`1/1` muerto, `0` sobrevivientes, `0` sin cobertura; `28 s`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/contracts/vehicles/register-vehicle-request-schema.ts`: **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`65/65` tests en verde** (`10.65 s`), cobertura global `35.62% Stmts | 26.30% Branch | 26.17% Funcs | 35.52% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 10. `TC-CORE-011` — Listado de vehículos disponibles por fecha

#### 10.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-011`
- **Módulo:** Veículos
- **Requisito / US:** `RF-03` — Listado de vehículos disponibles para un intervalo de fechas (`predictedStartDate`/`predictedEndDate`), excluyendo vehículos con conflicto de agenda.
- **Endpoint y Escenario:** `GET /vehicles/available?predictedStartDate=2026-03-10T08:00:00.000Z&predictedEndDate=2026-03-10T18:00:00.000Z` con `USER JWT` y `ADMIN JWT`, más escenarios de reglas de intervalo inválido (`400`), consulta sin fechas (`fetchAllAvailable`), filtro por `date=YYYY-MM-DD` (`fetchAllRequestableForSchedule`) y pruebas defensivas directas del caso de uso `fetchAvailableVehicles`.
- **Precondiciones (PDF):** Vehículos registrados; `USER` o `ADMIN` JWT válido.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 993–1159).
- **Código bajo prueba:** `core-service/src/use-cases/vehicles/fetch-available-vehicles.ts`, `core-service/src/routes/vehicle-router.ts` (`GET /vehicles/available`), `core-service/src/contracts/vehicles/list-available-vehicles-query-schema.ts`, `core-service/src/contracts/vehicles/vehicle-response-schema.ts`.

#### 10.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` reales) combinada con **pruebas unitarias defensivas** sobre `fetchAvailableVehicles(...)` para cubrir validaciones de dominio que la capa HTTP intercepta previamente mediante Zod. Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`fetchAllAvailable`, `fetchAllRequestableForSchedule`), `@/domains/requests/db/repository` (`findVehicleScheduleConflict`) y `@/messaging/*` (RabbitMQ). *(La resolución de conflictos de agenda en SQL se simula en `findVehicleScheduleConflict`; no consulta PostgreSQL real).*
- **Categoría:** `happy path` + `boundary` (igualdad `end === start` y orden invertido `end < start`) + `failure` (parámetro parcial / período inválido).
- **Criterios y Técnicas Aplicadas:**
  - **Partición de Equivalencia (Roles y Modos de Consulta):** `USER JWT` y `ADMIN JWT`; consulta con intervalo completo (`predictedStartDate` + `predictedEndDate`), sin fechas (`fetchAllAvailable`) y con `date=YYYY-MM-DD` (`fetchAllRequestableForSchedule`).
  - **Análisis de Valor Límite (Intervalo de Fechas):** `end === start`, `end < start`, fecha inicial sin fecha final y fecha final sin fecha inicial.
  - **Criterio de Cobertura de Ramas (V8) y Mutación (StrykerJS):** alcanzar `100%` de cobertura y `100%` de mutation score en `src/use-cases/vehicles/fetch-available-vehicles.ts`.

#### 10.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - `GET /vehicles/available?predictedStartDate=...&predictedEndDate=...` con `USER JWT` o `ADMIN JWT` responde `HTTP 200` devolviendo únicamente los vehículos disponibles sin conflicto en el intervalo, invocando `findVehicleScheduleConflict` con `vehicleId`, `Date` exactos e `ignoredRequestId: undefined`.
  - Intervalos inválidos (`end === start`, `end < start` o solo una fecha) son rechazados con `HTTP 400` en la ruta (sin consultar repositorios) y lanzan `InvalidRequestPeriodError` (`"A data final deve ser maior que a data inicial"`) en `fetchAvailableVehicles`.
  - Sin fechas en query retorna `HTTP 200` vía `fetchAllAvailable`; con `date=YYYY-MM-DD` retorna `HTTP 200` vía `fetchAllRequestableForSchedule`.

#### 10.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`PASS` parcial / `MUTANTE SOBREVIVIENTE` (`50.00%` Mutación) y ramas sin cubrir**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-011"`):** `1 passed | 40 skipped (41)` en `81 ms` (`responseTime: 8.83 ms`).
  - **Cobertura V8 inicial (`src/use-cases/vehicles/fetch-available-vehicles.ts`):** `73.33% Stmts | 58.33% Branch | 83.33% Funcs | 78.57% Lines` (líneas sin cubrir: `23-27, 35`).
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/use-cases/vehicles/fetch-available-vehicles.ts"`):** **`50.00%` total / `60.87%` covered** (`28` mutantes: `14` muertos, **`9` sobrevivientes**, **`5` sin cobertura**, `0` errores; `37 s`).
  - **Debilidades detectadas:**
    1. Solo probaba con `USER JWT`, sin cubrir explícitamente `ADMIN JWT` mencionado en las precondiciones del PDF.
    2. No verificaba los argumentos exactos (`Date` e `ignoredRequestId`) pasados a `findVehicleScheduleConflict`.
    3. Dejaba sin cobertura y con mutantes sobrevivientes las ramas sin fechas (`fetchAllAvailable`), con `date` (`fetchAllRequestableForSchedule`) y la guardia defensiva de período inválido (`lines 22-36`).

- **Diagnóstico y Corrección Aplicada:**
  - Se amplió `TC-CORE-011` en `core-service/tests/david-core.spec.ts` (de `1` a **`11` pruebas**):
    1. `it.each` con **`driver (USER JWT)`** y **`admin (ADMIN JWT)`** validando `HTTP 200`, filtrado del vehículo ocupado y argumentos exactos pasados a `findVehicleScheduleConflict`.
    2. `it.each` de **3 reglas HTTP de intervalo inválido** (`end === start`, `end < start`, solo `predictedStartDate`) → `HTTP 400` sin invocar repositorios.
    3. **Consulta sin fechas** (`GET /vehicles/available`) → `HTTP 200` invocando únicamente `fetchAllAvailable`.
    4. **Consulta solo por `date=2026-03-10`** → `HTTP 200` invocando únicamente `fetchAllRequestableForSchedule`.
    5. `it.each` de **4 pruebas unitarias defensivas** llamando directamente a `fetchAvailableVehicles(input)` (solo `start`, solo `end`, `end === start`, `end < start`) → rechaza con `InvalidRequestPeriodError` sin consultar repositorios.

- **Revalidación (después de la corrección):** **`PASS` (`11/11` tests) + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-011"`):** `11 passed | 40 skipped (51)` en `104 ms`.
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/vehicles/fetch-available-vehicles.ts"`):** subió de `50.00%` a **`100.00%` total / `100.00%` covered** (`28/28` muertos, `0` sobrevivientes, `0` sin cobertura, `0` errores; `46 s`).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/vehicles/fetch-available-vehicles.ts`: subió de `73.33% / 58.33%` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`75/75` tests en verde** (`10.54 s`), cobertura global `35.94% Stmts | 27.46% Branch | 26.51% Funcs | 35.77% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).

---

### 11. `TC-CORE-012` — Actualizar y eliminar vehículo

#### 11.1 Caso de Teste
- **ID Oficial (`Casos de Teste — SIF.pdf`):** `TC-CORE-012`
- **Módulo:** Veículos
- **Requisito / US:** `RF-03` — Actualización de atributos y eliminación administrativa de vehículos registrados, con auditoría y reflejo en el listado.
- **Endpoint y Escenario:** Flujo completo de 3 pasos (`PUT /admin/vehicles/:id -> 200`, `DELETE /admin/vehicles/:id -> 204`, `GET /admin/vehicles -> 200` confirmando vehículo ausente) + escenarios de rechazo de negocio (`404 Veículo não encontrado` y `400 A placa desse veículo já foi registrada`).
- **Precondiciones (PDF):** Vehículo registrado; Admin JWT.
- **Archivo de prueba:** `core-service/tests/david-core.spec.ts` (líneas 1161–1370).
- **Código bajo prueba:** `core-service/src/use-cases/vehicles/update-vehicle.ts`, `core-service/src/use-cases/vehicles/delete-vehicle.ts`, `core-service/src/routes/vehicle-router.ts` (`PUT /admin/vehicles/:id`, `DELETE /admin/vehicles/:id`, `GET /admin/vehicles`), `core-service/src/domains/vehicles/errors.ts`.

#### 11.2 Tipo de Caso & Criterio Usado
- **Nivel real de prueba:** Prueba de **componente HTTP / flujo CRUD en memoria** sobre Fastify real (`app.inject` + Zod + `@fastify/jwt` + `setErrorHandler` reales). Dependencias simuladas con `vi.mock`: `@/domains/vehicles/db/repository` (`findById`, `findByPlate`, `updateVehicle`, `deleteVehicle`, `fetchAll` respaldados por arreglo en memoria `storedVehicles`), `@/use-cases/audit-log-service` (`createAuditLog`) y `@/messaging/*` (RabbitMQ). *(No ejecuta `UPDATE`/`DELETE` SQL contra PostgreSQL real).*
- **Categoría:** `happy path` (flujo de 3 pasos del PDF) + `failure` (entidad inexistente `404`, colisión de placa con otro vehículo `400`, retorno `undefined` del repositorio `404`).
- **Criterios y Técnicas Aplicadas:**
  - **Verificación de Flujo Completo (PDF):** validar en secuencia `PUT 200` (payload exacto enviado a `updateVehicleRepository` + auditoría `VEHICLE.UPDATED`), `DELETE 204` (auditoría `VEHICLE.DELETED`) y `GET /admin/vehicles -> 200` confirmando la ausencia del vehículo eliminado.
  - **Partición de Equivalencia Negativa:** actualización/eliminación de ID inexistente, colisión de placa con vehículo de distinto ID y fallo defensivo cuando el repositorio retorna `undefined`.
  - **Criterio de Cobertura de Ramas (V8) y Mutación (StrykerJS):** alcanzar `100%` de cobertura y `100%` de mutation score en `update-vehicle.ts` y `delete-vehicle.ts`.

#### 11.3 Resultado Esperado
- Conforme a `Casos de Teste — SIF.pdf`:
  - **Paso 1:** `PUT /admin/vehicles/:id` responde `HTTP 200` con los datos actualizados, invoca `updateVehicleRepository` con todos los campos mapeados (incluido `imageUrl` no nulo) y llama a `createAuditLog` (`VEHICLE.UPDATED`).
  - **Paso 2:** `DELETE /admin/vehicles/:id` responde `HTTP 204`, invoca `deleteVehicleRepository(id)` y llama a `createAuditLog` (`VEHICLE.DELETED`).
  - **Paso 3:** `GET /admin/vehicles` responde `HTTP 200` confirmando que el vehículo eliminado ya no figura en el listado.
  - **Escenarios de rechazo:** ID inexistente o retorno `undefined` del repositorio responde `HTTP 404` (`"Veículo não encontrado"`); placa perteneciente a otro vehículo responde `HTTP 400` (`"A placa desse veículo já foi registrada"`), sin invocar `updateVehicleRepository`, `deleteVehicleRepository` ni `createAuditLog`.

#### 11.4 Resultado Obtenido
- **Fecha de ejecución:** `2026-11-26`
- **Evaluación Inicial (antes de corregir):** **`INCOMPLETO` frente al PDF + `MUTANTE SOBREVIVIENTE` (`57.14%` combinado)**
  - **Vitest aislado inicial (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-012"`):** `1 passed | 50 skipped (51)` en `85 ms` (`responseTime`: `15.02 ms` `PUT 200`, `0.89 ms` `DELETE 204`).
  - **Cobertura V8 inicial:**
    - `src/use-cases/vehicles/update-vehicle.ts`: `72.72% Stmts | 70% Branch | 100% Funcs | 72.72% Lines` (sin cubrir: `24, 30, 44`).
    - `src/use-cases/vehicles/delete-vehicle.ts`: `71.42% Stmts | 50% Branch | 100% Funcs | 71.42% Lines` (sin cubrir: `16, 22`).
  - **StrykerJS inicial (`npx.cmd stryker run -m "src/use-cases/vehicles/update-vehicle.ts,src/use-cases/vehicles/delete-vehicle.ts"`):** **`57.14%` total / `69.57%` covered** (`28` mutantes: `16` muertos, **`7` sobrevivientes**, **`5` sin cobertura**, `0` errores; `40 s`):
    - `update-vehicle.ts`: `55.56%` (`10/18` muertos, `5` sobrevivientes, `3` sin cobertura — incluía `ObjectLiteral -> {}` en el payload de `updateVehicleRepository`, `LogicalOperator ?? -> &&` en `imageUrl` y las guardias `404`/`400`).
    - `delete-vehicle.ts`: `60.00%` (`6/10` muertos, `2` sobrevivientes, `2` sin cobertura — guardias `if (!vehicle)` e `if (!deletedVehicle)`).
  - **Debilidades detectadas:**
    1. Omitía el **Paso 3 del PDF** (`GET /admin/vehicles` confirmando vehículo ausente tras la eliminación).
    2. No verificaba los argumentos exactos pasados a `updateVehicleRepository` (permitiendo que mutantes vaciaran el objeto de actualización o corrompieran `imageUrl ?? null`).
    3. No cubría las rutas de error `404` y `400` en `update-vehicle.ts` y `delete-vehicle.ts`.

- **Diagnóstico y Corrección Aplicada:**
  - Se amplió `TC-CORE-012` en `core-service/tests/david-core.spec.ts` (de `1` a **`6` pruebas**):
    1. En el flujo principal se conectaron los mocks sobre un estado en memoria `storedVehicles`, se agregó verificación estricta de `findVehicleById`, `findByPlate` y `updateVehicleRepository(VEHICLE_ID, { ... imageUrl: "https://cdn.sif.local/vehicles/toro-ultra.png" ... })`, y se completó el **Paso 3 (`GET /admin/vehicles -> 200`, `[]`)**.
    2. Se añadieron **3 pruebas de mutación para `PUT`**: vehículo no encontrado (`404`), placa perteneciente a otro vehículo (`400`) y repositorio retornando `undefined` (`404`).
    3. Se añadieron **2 pruebas de mutación para `DELETE`**: vehículo no encontrado (`404`) y repositorio retornando `undefined` (`404`).

- **Revalidación (después de la corrección):** **`PASS` (`6/6` tests) + `100.00%` Mutation Score y `100%` Cobertura**
  - **Vitest aislado (`npx.cmd vitest run tests/david-core.spec.ts -t "TC-CORE-012"`):** `6 passed | 50 skipped (56)` en `112 ms`.
  - **StrykerJS (`npx.cmd stryker run -m "src/use-cases/vehicles/update-vehicle.ts,src/use-cases/vehicles/delete-vehicle.ts"`):** subió de `57.14%` a **`100.00%` total / `100.00%` covered** (`28/28` muertos, `0` sobrevivientes, `0` sin cobertura, `0` errores; `50 s`):
    - `update-vehicle.ts`: subió de `55.56%` a **`100.00%`** (`18/18` muertos).
    - `delete-vehicle.ts`: subió de `60.00%` a **`100.00%`** (`10/10` muertos).
  - **Cobertura V8 (`npm.cmd run test:coverage`):**
    - `src/use-cases/vehicles/update-vehicle.ts`: subió de `72.72% / 70%` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - `src/use-cases/vehicles/delete-vehicle.ts`: subió de `71.42% / 50%` a **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - **Directorio completo `src/use-cases/vehicles/`:** **`100% Stmts | 100% Branch | 100% Funcs | 100% Lines`**.
    - Suite completa: `2 passed (2)` archivos, **`80/80` tests en verde** (`5.94 s`), cobertura global `36.34% Stmts | 28.43% Branch | 26.51% Funcs | 36.18% Lines`.
  - **Checks estáticos y build:** `npx.cmd tsc --noEmit` (`0` errores), `npm.cmd run lint` (`147` archivos, `0` errores), `npm.cmd run build` (`exit 0`).
