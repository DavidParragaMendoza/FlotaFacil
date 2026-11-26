# Plan de Acción: Auditoría Paso a Paso de Pruebas y Relatoría (`core-service` — David Párraga)

**Fecha de creación:** 2026-11-26  
**Rama de trabajo:** `test/david-core-auth-fleet`  
**Responsable:** David Párraga  
**Fuentes oficiales rectoras:**
- `Casos de Teste — SIF.pdf` (36 casos planeados — fuente oficial de IDs y roteiros).
- `Plano de Teste — SIF (Sistema Integrado de Frotas).pdf` (criterios metodológicos, cobertura >= 80%, mutación y trazabilidad).

**Entregables de este plan:**
- Plan maestro: `.agents/plan_accion_auditoria_tests_david.md` (este documento).
- Relatoría técnica definitiva: `relatorio_completo_test_david.md` (sin sobrescribir `RELATORIA_TESTES_DAVID.md`).
- Suite auditada y ampliada: `core-service/tests/david-core.spec.ts` (con cobertura V8 y análisis de mutación StrykerJS).

---

## 1. Alcance y Resolución Oficial de IDs

El alcance corresponde a los **13 casos asignados a David Párraga** en `core-service` según `Casos de Teste — SIF.pdf`:

| ID Oficial (`Casos de Teste — SIF.pdf`) | Módulo | Requisito | Descripción | Nota de trazabilidad |
|---|---|---|---|---|
| `TC-CORE-001` | Autenticación | `RF-01` | Login de administrador válido | Coincide con `david-core.spec.ts` |
| `TC-CORE-002` | Autenticación | `RF-01` | Campos de login vacíos | Coincide con `david-core.spec.ts` |
| `TC-CORE-003` | Autenticación | `RF-01` | CPF con longitud/formato inválido | Coincide con `david-core.spec.ts` |
| *(`TC-CORE-004` omitido)* | Login UI | `RF-01` | La fila 4 del PDF es `TC-ADMIN-001` | No pertenece a `core-service` |
| `TC-CORE-005` | RBAC | `RF-02` | Recurso protegido sin JWT | Coincide con `david-core.spec.ts` |
| `TC-CORE-006` | Usuários | `RF-01` | Crear usuário com dados válidos | Coincide con `david-core.spec.ts` |
| `TC-CORE-007` | Usuários | `RF-01` | E-mail inválido e campos obrigatórios | Coincide con `david-core.spec.ts` |
| `TC-CORE-008` | Veículos | `RF-03` | Registrar veículo válido | En `02_CASOS_DE_TESTE.md` (40 casos) este ID estaba desplazado |
| `TC-CORE-009` *(PDF: `TC-CORE-09`)* | Veículos | `RF-03` | Placa duplicada | Typo en el PDF (`TC-CORE-09`); normalizado como `TC-CORE-009` |
| `TC-CORE-010` | Veículos | `RF-03` | Enum e tipos inválidos | Coincide con el PDF oficial |
| `TC-CORE-011` | Veículos | `RF-03` | Lista de veículos disponíveis por data | Coincide con el PDF oficial |
| `TC-CORE-012` | Veículos | `RF-03` | Atualizar e excluir veículo | Coincide con el PDF oficial |
| `TC-CORE-013` | Solicitações | `RF-04` | Criar solicitação própria válida | Coincide con el PDF oficial |
| `TC-CORE-014` | Solicitações | `RF-04` | Campos obrigatórios vazios | Coincide con el PDF oficial |

> **Nota sobre divergencia documental:** El archivo antiguo `docs/01_PRIMEIRA_ENTREGA/02_CASOS_DE_TESTE.md` (40 casos) desplaza los IDs a partir de `TC-CORE-008`. Por confirmación explícita del usuario, **`Casos de Teste — SIF.pdf` es la fuente oficial única**.

---

## 2. Debilidades Identificadas en el Trabajo Previo (Commit `b2d6811`)

### 2.1 Debilidades en `.agents/contextodelaimplementaciondelostest.md` y `RELATORIA_TESTES_DAVID.md`
1. **Estructura no conforme al estándar requerido:** La relatoría usa `Identificador / Archivo / Estrategia / Resultado`, omitiendo la secuencia obligatoria:
   `Caso de Teste -> Tipo de Caso & Criterio Usado -> Resultado Esperado -> Resultado Obtenido (+ Diagnóstico / Corrección / Revalidación)`.
2. **Ausencia de Tipo de Caso y Criterio Usado:** No clasifica los casos (`happy path`, `boundary`, `special-input`, `failure`), el nivel real (`app.inject` con mocks vs. integración real) ni la técnica aplicada (Partición de Equivalencia, Valor Límite, Contrato Zod, RBAC, Cobertura/Mutación).
3. **Ocultamiento de defectos encontrados y corregidos:** En `TC-CORE-003` (`user-login-schema.ts`) y `TC-CORE-007` (`create-user-schema.ts`) el agente anterior halló fallos reales de contrato, los corrigió y reportó directamente `PASS` sin registrar el incidente inicial (`requisito -> caso -> ejecución -> incidente -> corrección`).
4. **Afirmaciones que exceden el alcance de los mocks:** Reporta "persistencia en BD", "auditoría registrada" y "evento de notificación publicado" cuando todos los repositorios Drizzle, `createAuditLog`, `notifyAdminsAboutNewRequest` y RabbitMQ están simulados con `vi.mock`.
5. **Inconsistencias de evidencia y tiempos:** Los tiempos HTTP en las secciones difieren de los de la tabla consolidada final (ej. `TC-CORE-001`: `98.24 ms` vs `88.78 ms`; `TC-CORE-009`: `0.66 ms` vs `1.30 ms`), al mezclar ejecuciones distintas sin fecha ni commit SHA.

### 2.2 Debilidades en Configuración, Herramientas y Calidad
1. **Faltan criterios de salida obligatorios del `Plano de Teste — SIF`:** No estaban instalados ni **`@vitest/coverage-v8`** (cobertura mínima >= 80% en reglas de negocio) ni **`StrykerJS`** (pruebas de mutación y score de mutación).
2. **Riesgo en CI Linux (`biome.json`):** El cambio a `"lineEnding": "crlf"` en `core-service/biome.json` resuelve advertencias locales en Windows, pero puede romper `npm run lint` en el runner `ubuntu-latest` de `.github/workflows/core-ci.yml`.
3. **Error silencioso en `core-service/tests/use-cases.spec.ts`:** El mock `saveTrackingMapToMinio: vi.fn()` agregado en `b2d6811` retorna `undefined`, provocando un `TypeError: Cannot read properties of undefined (reading 'imageKey')` en `stderr` dentro de `createTrackUseCase`.
4. **Commit monolítico:** `b2d6811` mezcló cambios en 3 contratos de producción, `tsconfig`, `biome.json`, `use-cases.spec.ts` y los 13 casos sin trazabilidad atómica ni verificación registrada de `npm run build`.

### 2.3 Debilidades Específicas en los 13 Tests de `core-service/tests/david-core.spec.ts`
- **`TC-CORE-001`:** Solo cubre camino feliz; no protege contra mutantes en `if (!foundUser)` ni `if (!isPasswordValid)` en `authenticate-admin.ts`.
- **`TC-CORE-002`:** Solo prueba `{ cpf: "", password: "" }` juntos; no aísla cada campo ni campos ausentes.
- **`TC-CORE-003`:** Ocultó el fallo previo en `user-login-schema.ts`; agrupa 4 entradas en un `for` dentro de un único `it()`.
- **`TC-CORE-005`:** Solo prueba ausencia de header `Authorization`; no cubre token inválido/expirado ni control de rol `403` (`RF-02`).
- **`TC-CORE-006`:** **Incompleto frente al PDF** — omite el Paso 2 (`GET /admin/users/:id`).
- **`TC-CORE-007`:** Ocultó el fallo previo en `create-user-schema.ts`; no verifica que `findUserByEmail`/`findUserByCpf` no sean invocados.
- **`TC-CORE-008`:** **Incompleto frente al PDF** — omite comprobar visibilidad en `GET /admin/vehicles`.
- **`TC-CORE-009`:** Normalizar alias `TC-CORE-09`; falta validar que el conteo de vehículos no aumenta; aserción redundante (`[400, 409]` + `400`).
- **`TC-CORE-010`:** Agrupa los 4 campos inválidos en una sola petición (dificulta matar mutantes individuales del esquema).
- **`TC-CORE-011`:** **Incompleto frente al PDF** — solo prueba rol `driver` (el PDF indica `USER/ADMIN JWT`), no verifica los argumentos exactos pasados a `findVehicleScheduleConflict` ni el borde de fechas (`end <= start`).
- **`TC-CORE-012`:** **Incompleto frente al PDF** — omite el Paso 3 (`GET /admin/vehicles` confirmando vehículo ausente) y no valida los argumentos enviados a `updateVehicleRepository`.
- **`TC-CORE-013`:** No valida `approvedBy: null` ni aclara el límite del mock frente a publicación RabbitMQ real.
- **`TC-CORE-014`:** Agrupa los 3 campos inválidos en una única petición y no verifica la no invocación de `findUserById`/`findVehicleById` ni UUID malformado.

---

## 3. Formato Obligatorio de Cada Caso en `relatorio_completo_test_david.md`

```markdown
### N. `TC-CORE-XXX` — Nombre del Caso

1. **Caso de Teste**
   - **ID / Módulo / Requisito:** `TC-CORE-XXX` | Módulo | `RF-XX`
   - **Endpoint y Escenario:** Método, ruta y precondiciones.
   - **Archivo de prueba:** `core-service/tests/david-core.spec.ts`
2. **Tipo de Caso & Criterio Usado**
   - **Nivel:** Unitario / Componente HTTP (`app.inject` con mocks) *[especificar qué es real y qué es mock]*.
   - **Categoría:** `happy path` / `boundary` / `special-input` / `failure`.
   - **Técnica / Criterio de prueba:** Partición de Equivalencia, Análisis de Valor Límite, Validación de Contrato Zod, RBAC, Cobertura de Ramas / Mutación.
3. **Resultado Esperado**
   - Código HTTP, estructura del payload, efectos esperados y verificación negativa (efectos que NO deben ocurrir) según `Casos de Teste — SIF.pdf`.
4. **Resultado Obtenido**
   - **Estado inicial:** `PASS` / `FAIL` / `INCOMPLETO` / `MUTANTE SOBREVIVIENTE`.
   - **Comando ejecutado y evidencia:** Comando exacto, salida real de Vitest, cobertura V8 y StrykerJS (cuando aplique), y fecha.
   - **Diagnóstico y Corrección Aplicada** *(si hubo error, incompletitud o mutantes sobrevivientes)*:
     - Qué falló, faltaba o sobrevivió (causa raíz / mutante detectado).
     - Qué se hizo para corregirlo (cambios en test/código, nuevos casos añadidos para matar mutantes).
     - **Revalidación:** Resultado tras la corrección (`PASS`), comando y commit SHA publicado.
```

---

## 4. Plan de Ejecución por Fases

### Fase 0 — Alineación, Herramientas de Calidad y Línea Base
1. Instalar `@vitest/coverage-v8`, `@stryker-mutator/core` y `@stryker-mutator/vitest-runner` en `core-service`.
2. Configurar `vitest.config.ts` (`coverage` V8), `stryker.config.mjs`, scripts `test:coverage` y `test:mutation` en `package.json` y entradas `.stryker-tmp/` y `reports/` en `core-service/.gitignore`.
3. Corregir el `stderr TypeError` de `saveTrackingMapToMinio` en `core-service/tests/use-cases.spec.ts`.
4. Documentar la advertencia `lineEnding: "crlf"` en `core-service/biome.json` frente a `ubuntu-latest`.
5. Ejecutar línea base completa (`test`, `test:coverage`, smoke `stryker`, `build`, `lint`, `tsc --noEmit`) y crear `relatorio_completo_test_david.md`.
6. Commit atómico y `git push origin test/david-core-auth-fleet`.

### Fase 1 — Revisión Iterativa Caso por Caso (13 Ciclos)
Para cada caso en orden (`TC-CORE-001`, `002`, `003`, `005`, `006`, `007`, `008`, `009`, `010`, `011`, `012`, `013`, `014`):
1. **Auditar:** Comparar test actual + código fuente contra `Casos de Teste — SIF.pdf`.
2. **Ejecutar:** Correr el caso aislado (`npx.cmd vitest run -t "TC-CORE-XXX"`), revisar cobertura del módulo y correr StrykerJS sobre los archivos del caso.
3. **Diagnosticar y Corregir:** Si hay error, paso faltante del PDF o mutantes sobrevivientes, documentar el estado inicial, añadir los tests/assertions necesarios para completar el roteiro y matar los mutantes, y revalidar (`vitest`, `tsc --noEmit`, `biome check`, `stryker`).
4. **Documentar en `relatorio_completo_test_david.md`:** Completar la sección del caso con el formato obligatorio y evidencia real.
5. **Revisar, Commit y Push:** Revisión del usuario, commit atómico del caso y `git push origin test/david-core-auth-fleet` antes de pasar al siguiente caso.

### Fase 2 — Validación Global, Cobertura Final, Mutación y Cierre
1. Ejecutar suite completa (`npm.cmd run test`, `npm.cmd run test:coverage`, `npm.cmd run test:mutation`, `npm.cmd run build`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`).
2. Consolidar la tabla de resultados finales en `relatorio_completo_test_david.md` con cifras de una única corrida identificable (fecha, commit SHA, % cobertura V8, % mutation score Stryker, separación clara entre pruebas unitarias/componente con mocks e integración real pendiente en Docker).
3. Commit final y push a `test/david-core-auth-fleet`.
