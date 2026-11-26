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
| 1 | `TC-CORE-001` | Autenticação | `RF-01` | Login de administrador válido | Pendiente de auditoría individual |
| 2 | `TC-CORE-002` | Autenticação | `RF-01` | Campos de login vazios | Pendiente de auditoría individual |
| 3 | `TC-CORE-003` | Autenticação | `RF-01` | CPF com comprimento/formato inválido | Pendiente de auditoría individual |
| — | *(`TC-CORE-004` no existe; fila 4 es `TC-ADMIN-001`)* | Login UI | `RF-01` | Login seed pelo navegador (Playwright `:3000`) | Fuera de alcance `core-service` |
| 4 | `TC-CORE-005` | RBAC | `RF-02` | Recurso protegido sem JWT | Pendiente de auditoría individual |
| 5 | `TC-CORE-006` | Usuários | `RF-01` | Criar usuário com dados válidos | Pendiente de auditoría individual |
| 6 | `TC-CORE-007` | Usuários | `RF-01` | E-mail inválido e campos obrigatórios | Pendiente de auditoría individual |
| 7 | `TC-CORE-008` | Veículos | `RF-03` | Registrar veículo válido | Pendiente de auditoría individual |
| 8 | `TC-CORE-009` *(PDF: `TC-CORE-09`)* | Veículos | `RF-03` | Placa duplicada | Pendiente de auditoría individual |
| 9 | `TC-CORE-010` | Veículos | `RF-03` | Enum e tipos inválidos | Pendiente de auditoría individual |
| 10 | `TC-CORE-011` | Veículos | `RF-03` | Lista de veículos disponíveis por data | Pendiente de auditoría individual |
| 11 | `TC-CORE-012` | Veículos | `RF-03` | Atualizar e excluir veículo | Pendiente de auditoría individual |
| 12 | `TC-CORE-013` | Solicitações | `RF-04` | Criar solicitação própria válida | Pendiente de auditoría individual |
| 13 | `TC-CORE-014` | Solicitações | `RF-04` | Campos obrigatórios vazios | Pendiente de auditoría individual |
