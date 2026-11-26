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
| 5 | `TC-CORE-006` | Usuários | `RF-01` | Criar usuário com dados válidos | Pendiente de auditoría individual |
| 6 | `TC-CORE-007` | Usuários | `RF-01` | E-mail inválido e campos obrigatórios | Pendiente de auditoría individual |
| 7 | `TC-CORE-008` | Veículos | `RF-03` | Registrar veículo válido | Pendiente de auditoría individual |
| 8 | `TC-CORE-009` *(PDF: `TC-CORE-09`)* | Veículos | `RF-03` | Placa duplicada | Pendiente de auditoría individual |
| 9 | `TC-CORE-010` | Veículos | `RF-03` | Enum e tipos inválidos | Pendiente de auditoría individual |
| 10 | `TC-CORE-011` | Veículos | `RF-03` | Lista de veículos disponíveis por data | Pendiente de auditoría individual |
| 11 | `TC-CORE-012` | Veículos | `RF-03` | Atualizar e excluir veículo | Pendiente de auditoría individual |
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
