# Relatoría Técnica de Ejecución de Pruebas — SIF (core-service)
**Responsable:** David Párraga
**Rama:** `test/david-core-auth-fleet`
**Framework:** Vitest + Fastify Inject + Drizzle ORM

---

## Registro de Ejecución por Caso de Prueba

### 1. `TC-CORE-001` — Login de administrador válido

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-001`
  - **Módulo**: Autenticación y RBAC
  - **Requisito / US**: `RF-01` — Login de administrador válido (`POST /admin/auth` -> `200 OK`, emisión de JWT y datos del usuario `admin`).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (creado para alojar la suite de pruebas de integración HTTP con `app.inject` asignada a David Párraga).
  - `core-service/tests/use-cases.spec.ts` (aislamiento de mocks de servicios externos de mapas estáticos y MinIO para evitar timeouts de red en ejecución local).

- **Estrategia y Mocks**:
  - **Inyección HTTP (`app.inject`)**: Se levanta la instancia real de Fastify (`src/app.ts`) con el validador/serializador Zod (`fastify-type-provider-zod`), el plugin `@fastify/jwt` (`src/plugins/jwt.ts`) y el enrutador `authRouter` (`src/routes/auth-router.ts`).
  - **Aislamiento de infraestructura (RabbitMQ)**: Como `app.ts` registra `rabbitPlugin` al inicializar (`app.ready()`), se simularon con `vi.mock` los módulos `@/messaging/client`, `@/messaging/setup` y `@/messaging/consumers` para evitar conexiones AMQP reales durante las pruebas HTTP.
  - **Mock de Base de Datos (Repositorio Drizzle)**: Se interceptó `@/domains/users/db/repository` mediante `vi.mock`, configurando `findUserAdminByCpf` para retornar el usuario administrador seed (`cpf: "00000000000"`, `email: "admin@sif.com"`, `name: "AdminSIF"`, `role: "admin"`).
  - **Hash de Contraseña (`bcryptjs`)**: Se generó dinámicamente un hash real con `await bcrypt.hash("123456", 10)` y se inyectó en `passwordHash` del usuario simulado, permitiendo que el caso de uso `authenticateAdmin` ejecute `bcrypt.compare("123456", foundUser.passwordHash)` de extremo a extremo sin alterar la lógica criptográfica.

- **Cómo funciona el flujo probado**:
  1. `app.inject` envía una petición `POST /admin/auth` con el payload `{ cpf: "00000000000", password: "123456" }`.
  2. Fastify valida el cuerpo de entrada contra `adminLoginSchema` (`cpf` de exactamente 11 caracteres y `password` no vacío).
  3. El controlador invoca `authenticateAdmin(request.body, tokenService)` pasando el servicio JWT real de Fastify (`makeFastifyJwtService(app)`).
  4. `authenticateAdmin` consulta `findUserAdminByCpf("00000000000")`, verifica la contraseña con `bcrypt.compare` y firma un JWT con `{ id, role: "admin" }`.
  5. La respuesta se filtra y serializa mediante `authResponseSchema`, garantizando que `passwordHash` nunca se exponga en el JSON devuelto.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `25 passed (25 tests)`.
  - **Tiempo de respuesta**: `411 ms` en Vitest (`responseTime: 98.24 ms` en el motor HTTP de Fastify).
  - **Assertions validados**:
    - Código de estado HTTP igual a `200`.
    - Llamada única a `findUserAdminByCpf("00000000000")`.
    - Presencia de `token` JWT tipo `string` no vacío en el payload de respuesta.
    - Objeto `user` coincide exactamente con `{ id, name: "AdminSIF", email: "admin@sif.com", photoUrl: null, role: "admin" }` y no expone `passwordHash`.
    - Verificación criptográfica del token con `app.jwt.verify(body.token)` confirmando el payload `{ id: "11111111-1111-4111-8111-111111111111", role: "admin" }`.

---

### 2. `TC-CORE-002` — Campos de login vacíos

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-002`
  - **Módulo**: Autenticación y RBAC
  - **Requisito / US**: `RF-01` — Campos de login vacíos (`POST /admin/auth` -> `400 Bad Request`, errores identificando `cpf` y `password`, sin emisión de token ni consulta a base de datos).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-002` dentro del bloque `1. Autenticación y RBAC`).

- **Estrategia y Mocks**:
  - **Inyección HTTP (`app.inject`)**: Se envía una petición `POST /admin/auth` con el payload `{ cpf: "", password: "" }` directamente contra la instancia de Fastify (`src/app.ts`).
  - **Validación de Esquema (`Zod` + `fastify-type-provider-zod`)**: El compilador de validación de Fastify intercepta la petición antes de llegar al controlador `authenticateAdmin`, evaluando `adminLoginSchema` (`cpf: z.string().min(11).max(11)` y `password: z.string().min(1)`).
  - **Verificación Negativa de Base de Datos**: Se reutiliza el mock de `findUserAdminByCpf` (limpiado en `beforeEach` con `vi.clearAllMocks()`) para comprobar que el repositorio Drizzle jamás es invocado cuando los campos están vacíos.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `26 passed (26 tests)`.
  - **Tiempo de respuesta**: `2.05 ms` en el motor HTTP de Fastify (`234 ms` para toda la suite `david-core.spec.ts`).
  - **Assertions validados**:
    - Código de estado HTTP igual a `400`.
    - `findUserAdminByCpf` no fue invocado (`not.toHaveBeenCalled()`).
    - El JSON de respuesta no contiene la propiedad `token`.
    - La propiedad `message` devuelta por `app.setErrorHandler` reporta explícitamente la falla de validación en ambos campos (`cpf` y `password`).

---

### 3. `TC-CORE-003` — CPF con longitud o formato inválido

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-003`
  - **Módulo**: Autenticación y RBAC
  - **Requisito / US**: `RF-01` — CPF con longitud o formato inválido (`POST /admin/auth` -> `400 Bad Request` para longitudes de 10 y 12 caracteres y formatos con caracteres no numéricos; no se emite token).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-003` iterando sobre múltiples entradas límite y formatos inválidos).
  - `core-service/src/contracts/users/user-login-schema.ts` (se reforzó `adminLoginSchema` añadiendo `.regex(/^\d+$/)` junto a `.min(11).max(11)` para alinearlo con el contrato de `admin-app/src/server/contracts/auth-schema.ts` y garantizar que cadenas de 11 caracteres no numéricos sean rechazadas con `HTTP 400` en la capa de contrato en lugar de llegar a la base de datos y devolver `401`).

- **Estrategia y Mocks**:
  - **Análisis de Valores Límite y Clases de Equivalencia (`app.inject`)**: Se ejecutaron cuatro peticiones secuenciales hacia `POST /admin/auth` con contraseña válida (`"123456"`) y cuatro variantes inválidas de `cpf`:
    1. `"1234567890"` — Frontera inferior inválida (`10` caracteres, menor al mínimo de `11`).
    2. `"123456789012"` — Frontera superior inválida (`12` caracteres, mayor al máximo de `11`).
    3. `"1234567890a"` — Longitud exacta (`11` caracteres) pero con carácter alfabético no numérico.
    4. `"000.000.000-00"` — Formato con signos de puntuación no numéricos (`14` caracteres).
  - **Verificación Negativa de Persistencia**: Se verificó mediante el mock `findUserAdminByCpf` que ninguna de las cuatro peticiones inválidas alcanzó la capa de repositorio de Drizzle ORM.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `27 passed (27 tests)`.
  - **Tiempo de respuesta**: `1.57 ms`, `0.65 ms`, `1.07 ms` y `0.45 ms` respectivamente en cada una de las 4 inyecciones HTTP (`235 ms` total de la suite `david-core.spec.ts`).
  - **Assertions validados**:
    - Código de estado HTTP igual a `400` en los 4 intentos.
    - Ninguna respuesta incluye la propiedad `token`.
    - El mensaje de error (`body.message`) referencia explícitamente el campo `cpf` en cada rechazo.
    - `findUserAdminByCpf` presenta `0` invocaciones (`not.toHaveBeenCalled()`).

---

### 4. `TC-CORE-005` — Acceso a rutas protegidas sin JWT

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-005`
  - **Módulo**: Autenticación y RBAC
  - **Requisito / US**: `RF-02` — Acceso a recursos protegidos sin cabecera `Authorization` JWT (`GET /vehicles` y `GET /admin/vehicles` -> `401 Unauthorized`; no se consulta ni modifica recurso).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el mock de `@/domains/vehicles/db/repository` y el test `TC-CORE-005` dentro del bloque `1. Autenticación y RBAC`).

- **Estrategia y Mocks**:
  - **Inyección HTTP sin credenciales (`app.inject`)**: Se realizaron dos peticiones `GET` secuenciales hacia `/vehicles` (protegida por `[verifyJwt, authorize(["driver", "admin"])]`) y `/admin/vehicles` (protegida por `[verifyJwt, authorize(["admin"])]`) omitiendo deliberadamente el header `Authorization`.
  - **Evaluación de Hooks de Seguridad (`verifyJwt` + `authorize`)**: El `preHandler` `verifyJwt` (`src/hooks/verify-jwt.ts`) invoca `await request.jwtVerify()`. Al no existir token Bearer en la solicitud, captura la excepción y responde inmediatamente con `HTTP 401` y `{ error: "Token inválido ou expirado" }`, cortando el ciclo de vida antes del controlador `fetchVehicles()`.
  - **Mock de Repositorio de Vehículos**: Se simuló `@/domains/vehicles/db/repository` (`fetchAll: vi.fn()`) para demostrar que la base de datos jamás es consultada ante una solicitud no autenticada.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `28 passed (28 tests)`.
  - **Tiempo de respuesta**: `0.49 ms` (`GET /vehicles`) y `0.18 ms` (`GET /admin/vehicles`) en el motor HTTP de Fastify (`356 ms` para toda la suite `david-core.spec.ts`).
  - **Assertions validados**:
    - Código de estado HTTP igual a `401` tanto en `GET /vehicles` como en `GET /admin/vehicles`.
    - Cuerpo JSON igual a `{ error: "Token inválido ou expirado" }` en ambas rutas.
    - `fetchAll` del repositorio de vehículos presenta `0` invocaciones (`not.toHaveBeenCalled()`), confirmando que no se consultó ningún recurso.

---

### 5. `TC-CORE-006` — Registro de usuario con datos válidos

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-006`
  - **Módulo**: Gestión de Usuarios
  - **Requisito / US**: `RF-01` — Registro de usuario con datos válidos (`POST /admin/users` -> `201 Created`, persistencia con contraseña hasheada no reversible y registro de auditoría).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el bloque `2. Gestión de Usuarios`, el helper `getAdminAuthHeader()` firmado con `app.jwt.sign` y el caso `TC-CORE-006`).

- **Estrategia y Mocks**:
  - **Inyección HTTP Autenticada (`app.inject`)**: Se firma un token JWT real de rol `admin` mediante `app.jwt.sign({ id: ADMIN_ID, role: "admin" })` y se envía en la cabecera `Authorization: Bearer <token>` hacia `POST /admin/users`.
  - **Mocks de Repositorio y Auditoría**: Se simularon `findUserByEmail` y `findUserByCpf` devolviendo `undefined` (sin colisión de unicidad), `insertUser` devolviendo la entidad creada junto con el `passwordHash` generado, y `createAuditLog` (`@/use-cases/audit-log-service`) para verificar la trazabilidad de la operación.
  - **Verificación de Hash Criptográfico (`bcryptjs`)**: Se inspeccionó el argumento recibido por `insertUser` para comprobar con `bcrypt.compare("driverPassword123", insertedPayload.passwordHash)` que la contraseña se almacena cifrada y nunca en texto plano.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `33 passed (33 tests)`.
  - **Tiempo de respuesta**: `85.39 ms` en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP igual a `201`.
    - Verificación previa de unicidad invocando `findUserByEmail("carlos@sif.com")` y `findUserByCpf("12345678901")`.
    - `insertUser` recibe un `passwordHash` válido de `bcrypt` distinto de la contraseña en texto plano.
    - El JSON de respuesta incluye `id`, `name`, `email`, `cpf`, `cnh`, `phone`, `department` y `role: "driver"`, omitiendo `password` y `passwordHash`.
    - Registro de auditoría invocado con `{ action: "USER.CREATED", entityId: USER_ID, performedBy: ADMIN_ID }`.

---

### 6. `TC-CORE-007` — E-mail inválido y campos obligatorios vacíos

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-007`
  - **Módulo**: Gestión de Usuarios
  - **Requisito / US**: `RF-01` — E-mail inválido y campos obligatorios vacíos en creación de usuario (`POST /admin/users` -> `400 Bad Request`; cada campo inválido identificado; ninguna fila nueva creada).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-007` dentro del bloque `2. Gestión de Usuarios`).
  - `core-service/src/contracts/users/create-user-schema.ts` (se reforzaron `name: z.string().min(1)` y `password: z.string().min(1)` en `createUserSchema` para impedir que cadenas vacías `""` superen la validación de esquema).

- **Estrategia y Mocks**:
  - **Inyección HTTP en Dos Pasos (`app.inject`)**:
    1. **Paso 1 (Campos obligatorios vacíos)**: Se envía `POST /admin/users` con token `admin` y `{ name: "", email: "", password: "", cpf: "12345678901", phone: "84999999999" }`.
    2. **Paso 2 (Formato de e-mail inválido)**: Se envía `POST /admin/users` con `name` y `password` válidos pero con `email: "correo-invalido-sin-arroba"`.
  - **Verificación Negativa de Persistencia y Auditoría**: Se comprueba mediante los mocks `insertUser` y `createAuditLog` que ninguna de las dos peticiones defectuosas ejecuta inserciones ni genera eventos de auditoría.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `33 passed (33 tests)`.
  - **Tiempo de respuesta**: `0.99 ms` (campos vacíos) y `0.49 ms` (e-mail inválido) en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP igual a `400` en ambos intentos.
    - En el Paso 1, `body.message` identifica explícitamente los tres campos obligatorios vacíos (`name`, `email` y `password`).
    - En el Paso 2, `body.message` identifica explícitamente el campo `email`.
    - `insertUser` y `createAuditLog` presentan `0` invocaciones (`not.toHaveBeenCalled()`).

---

### 7. `TC-CORE-008` — Registrar vehículo válido

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-008`
  - **Módulo**: Gestión de Vehículos
  - **Requisito / US**: `RF-03` — Registrar vehículo válido (`POST /admin/vehicles` -> `201 Created`, vehículo persistido y auditado).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el bloque `3. Gestión de Vehículos` y el caso `TC-CORE-008`).

- **Estrategia y Mocks**:
  - **Inyección HTTP Autenticada (`app.inject`)**: Se envía `POST /admin/vehicles` con cabecera `Authorization: Bearer <adminToken>` y payload válido `{ plate: "ABC1D23", model: "Fiat Toro", year: 2024, odometer: 1200, imageUrl: null, status: "AVAILABLE", type: "CAR" }`.
  - **Mocks de Repositorio y Auditoría**: Se configuró `findByPlate` devolviendo `undefined` (placa libre) e `insertVehicle` devolviendo el vehículo registrado con su `id` UUID y marcas de tiempo, además de interceptar `createAuditLog`.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `33 passed (33 tests)`.
  - **Tiempo de respuesta**: `1.66 ms` en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP igual a `201`.
    - `findByPlate` fue invocado con `"ABC1D23"` e `insertVehicle` fue llamado con los atributos exactos del vehículo.
    - El payload de respuesta coincide con el contrato `vehicleResponseSchema` (`id`, `plate: "ABC1D23"`, `model: "Fiat Toro"`, `year: 2024`, `odometer: 1200`, `status: "AVAILABLE"`, `type: "CAR"`).
    - `createAuditLog` fue invocado con `{ action: "VEHICLE.CREATED", entityId: VEHICLE_ID, performedBy: ADMIN_ID }`.

---

### 8. `TC-CORE-009` — Registro de vehículo con placa duplicada

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-009`
  - **Módulo**: Gestión de Vehículos
  - **Requisito / US**: `RF-03` — Registro de vehículo con placa duplicada (`POST /admin/vehicles` -> `400/409` conforme al contrato de errores del dominio; no se inserta vehículo duplicado).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-009` dentro del bloque `3. Gestión de Vehículos`).

- **Estrategia y Mocks**:
  - **Simulación de Colisión de Placa**: Se configuró `vi.mocked(findByPlate).mockResolvedValue(makeVehicle())` para simular que la placa `"ABC1D23"` ya se encuentra registrada en PostgreSQL.
  - **Manejo de Excepción de Dominio (`PlateAlreadyRegisteredError`)**: El caso de uso `registerVehicle` lanza `PlateAlreadyRegisteredError` (`src/domains/vehicles/errors.ts`, definido con código HTTP `400` y mensaje `"A placa desse veículo já foi registrada"`), el cual es capturado por `app.setErrorHandler`.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `33 passed (33 tests)`.
  - **Tiempo de respuesta**: `0.66 ms` en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP dentro de `[400, 409]` (específicamente `400` según `PlateAlreadyRegisteredError`).
    - Cuerpo JSON igual a `{ message: "A placa desse veículo já foi registrada" }`.
    - `insertVehicle` y `createAuditLog` presentan `0` invocaciones (`not.toHaveBeenCalled()`).

---

### 9. `TC-CORE-010` — Enums y tipos de datos inválidos

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-010`
  - **Módulo**: Gestión de Vehículos
  - **Requisito / US**: `RF-03` — Enums (`status`, `type`) y tipos numéricos (`year`, `odometer`) inválidos al registrar vehículo (`POST /admin/vehicles` -> `400 Bad Request`; no se persiste vehículo).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-010` dentro del bloque `3. Gestión de Vehículos`).

- **Estrategia y Mocks**:
  - **Inyección HTTP con Tipos y Enums Fuera de Contrato (`app.inject`)**: Se envió una petición `POST /admin/vehicles` con token `admin` y valores inválidos para cuatro propiedades del esquema `vehicleRequestSchema`:
    - `year: "dos-mil-veinticuatro"` (string en lugar de `number`).
    - `odometer: "mil-doscientos"` (string en lugar de `number`).
    - `status: "STATUS_INEXISTENTE"` (fuera del enum `["AVAILABLE", "IN_USE", "MAINTENANCE"]`).
    - `type: "NAVE_ESPACIAL"` (fuera del enum `["CAR", "MOTORCYCLE", "TRUCK", "TRACTOR", "VAN"]`).
  - **Verificación Negativa**: Se verificó que `findByPlate`, `insertVehicle` y `createAuditLog` no fueran llamados.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `33 passed (33 tests)`.
  - **Tiempo de respuesta**: `0.58 ms` en el motor HTTP de Fastify (`416 ms` total de la suite `david-core.spec.ts`).
  - **Assertions validados**:
    - Código de estado HTTP igual a `400`.
    - El mensaje de validación (`body.message`) reporta explícitamente las fallas en `year`, `odometer`, `status` y `type`.
    - `findByPlate`, `insertVehicle` y `createAuditLog` presentan `0` invocaciones (`not.toHaveBeenCalled()`).

---

### 10. `TC-CORE-011` — Listado de vehículos disponibles por fecha

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-011`
  - **Módulo**: Gestión de Vehículos
  - **Requisito / US**: `RF-03` — Listado de vehículos disponibles filtrados por rango de fechas (`GET /vehicles/available?predictedStartDate=...&predictedEndDate=...` -> `200 OK`; retorna únicamente vehículos sin conflicto de agenda).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el mock de `@/domains/requests/db/repository`, `fetchAllRequestableForSchedule` y el caso `TC-CORE-011` dentro del bloque `3. Gestión de Vehículos`).

- **Estrategia y Mocks**:
  - **Inyección HTTP con Querystring de Rango Horario (`app.inject`)**: Se envió una petición `GET /vehicles/available?predictedStartDate=2026-03-10T08:00:00.000Z&predictedEndDate=2026-03-10T18:00:00.000Z` autenticada con un JWT de rol `driver` (`getDriverAuthHeader()`).
  - **Simulación de Conflicto de Agenda**: Se configuró `fetchAllRequestableForSchedule` devolviendo dos vehículos (`freeVehicle` con placa `"ABC1D23"` y `busyVehicle` con placa `"XYZ9K88"`). A continuación, se simuló `findVehicleScheduleConflict` para devolver `undefined` en `freeVehicle` y una solicitud activa en `busyVehicle`.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `37 passed (37 tests)`.
  - **Tiempo de respuesta**: `1.13 ms` en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP igual a `200`.
    - `fetchAllRequestableForSchedule` fue invocado `1` vez y `findVehicleScheduleConflict` fue evaluado `2` veces (una por cada vehículo elegible).
    - El arreglo JSON devuelto tiene longitud `1` y contiene exclusivamente el vehículo sin conflicto (`id: VEHICLE_ID`, `plate: "ABC1D23"`).

---

### 11. `TC-CORE-012` — Actualizar y eliminar vehículo

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-012`
  - **Módulo**: Gestión de Vehículos
  - **Requisito / US**: `RF-03` — Actualizar datos de un vehículo (`PUT /admin/vehicles/:id` -> `200 OK`) y eliminarlo (`DELETE /admin/vehicles/:id` -> `204 No Content`).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-012` dentro del bloque `3. Gestión de Vehículos`).

- **Estrategia y Mocks**:
  - **Flujo Secuencial en Dos Pasos (`PUT` + `DELETE`)**:
    1. **Paso 1 (`PUT /admin/vehicles/:id`)**: Se simularon `findVehicleById`, `findByPlate` (mismo ID de vehículo) y `updateVehicleRepository` devolviendo el vehículo actualizado (`model: "Fiat Toro Ultra"`, `odometer: 2500`).
    2. **Paso 2 (`DELETE /admin/vehicles/:id`)**: Se simularon `findVehicleById` y `deleteVehicleRepository` devolviendo la entidad eliminada para confirmar el borrado y el registro de auditoría.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `37 passed (37 tests)`.
  - **Tiempo de respuesta**: `1.26 ms` (`PUT`) y `0.53 ms` (`DELETE`) en el motor HTTP de Fastify.
  - **Assertions validados**:
    - `PUT /admin/vehicles/:id` responde `HTTP 200` con `{ id: VEHICLE_ID, model: "Fiat Toro Ultra", odometer: 2500 }` y registra auditoría `VEHICLE.UPDATED`.
    - `DELETE /admin/vehicles/:id` responde `HTTP 204`, invoca `deleteVehicleRepository(VEHICLE_ID)` y registra auditoría `VEHICLE.DELETED`.

---

### 12. `TC-CORE-013` — Crear solicitud propia válida

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-013`
  - **Módulo**: Solicitudes de Flota (Fase Inicial)
  - **Requisito / US**: `RF-04` — Crear solicitud propia de uso de vehículo (`POST /me/requests` -> `201 Created`, estado inicial `PENDING`, auditoría y disparo de notificación a administradores).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el mock de `@/use-cases/notification-service`, el bloque `4. Solicitudes de Flota (Fase Inicial)` y el caso `TC-CORE-013`).

- **Estrategia y Mocks**:
  - **Inyección HTTP con JWT de Conductor (`app.inject`)**: Se envió `POST /me/requests` autenticado como `driver` (`USER_ID`) con `{ vehicleId: VEHICLE_ID, predictedStartDate: "2026-03-15T08:00:00.000Z", predictedEndDate: "2026-03-15T12:00:00.000Z", destination: "Campus Pau dos Ferros", reason: "Visita técnica institucional" }`.
  - **Mocks de Dominio, Transacción y Notificaciones**: Se simularon `findUserById` (conductor válido), `findVehicleById` (vehículo `AVAILABLE`), `insertRequestWithScheduleChecks` (retornando `{ request }` sin conflictos de agenda), `createAuditLog` y `notifyAdminsAboutNewRequest`.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `37 passed (37 tests)`.
  - **Tiempo de respuesta**: `1.72 ms` en el motor HTTP de Fastify.
  - **Assertions validados**:
    - Código de estado HTTP igual a `201`.
    - `insertRequestWithScheduleChecks` recibe `status: "PENDING"`, `userId: USER_ID`, `vehicleId: VEHICLE_ID` y las fechas convertidas a instancias `Date`.
    - El JSON de respuesta cumple `myRequestResponseSchema` incluyendo los datos de la solicitud y el objeto anidado `vehicle`.
    - Se invoca `createAuditLog` con `{ action: "REQUEST.CREATED", entityId: REQUEST_ID, performedBy: USER_ID }` y `notifyAdminsAboutNewRequest(REQUEST_ID)`.

---

### 13. `TC-CORE-014` — Campos obligatorios vacíos en solicitud

- **Identificador y Requisito**:
  - **ID**: `TC-CORE-014`
  - **Módulo**: Solicitudes de Flota (Fase Inicial)
  - **Requisito / US**: `RF-04` — Rechazo de solicitud propia con campos obligatorios vacíos o ausentes (`POST /me/requests` -> `400 Bad Request`; ninguna solicitud persistida ni notificación publicada).

- **Archivo modificado/creado**:
  - `core-service/tests/david-core.spec.ts` (se añadió el caso `TC-CORE-014` dentro del bloque `4. Solicitudes de Flota (Fase Inicial)`).

- **Estrategia y Mocks**:
  - **Validación de Contrato (`createMyRequestSchema`)**: Se inyectó una petición `POST /me/requests` omitiendo `vehicleId` y enviando `destination: ""` y `reason: ""` vacíos.
  - **Verificación Negativa de Persistencia y Eventos**: Se comprobó que el rechazo en la capa Zod impide cualquier llamada a `insertRequestWithScheduleChecks`, `createAuditLog` y `notifyAdminsAboutNewRequest`.

- **Resultado y Evidencia**:
  - **Comando ejecutado**: `npm.cmd run test` (ejecuta `vitest run` en `core-service`).
  - **Estado**: **PASS (En verde)** — `2 passed (2 test files)`, `37 passed (37 tests)`.
  - **Tiempo de respuesta**: `0.51 ms` en el motor HTTP de Fastify (`433 ms` para toda la suite `david-core.spec.ts`).
  - **Assertions validados**:
    - Código de estado HTTP igual a `400`.
    - `body.message` identifica explícitamente las fallas en `vehicleId`, `destination` y `reason`.
    - `insertRequestWithScheduleChecks`, `createAuditLog` y `notifyAdminsAboutNewRequest` presentan `0` invocaciones (`not.toHaveBeenCalled()`).

---

## Resumen Consolidado de Ejecución (`core-service`)

| # | ID Caso | Módulo | Endpoint / Método | Código Esperado | Estado | Tiempo HTTP |
|---|---|---|---|---|---|---|
| 1 | `TC-CORE-001` | Autenticación y RBAC | `POST /admin/auth` | `200 OK` | PASS | `88.78 ms` |
| 2 | `TC-CORE-002` | Autenticación y RBAC | `POST /admin/auth` | `400 Bad Request` | PASS | `2.02 ms` |
| 3 | `TC-CORE-003` | Autenticación y RBAC | `POST /admin/auth` (x4) | `400 Bad Request` | PASS | `0.78 - 1.87 ms` |
| 4 | `TC-CORE-005` | Autenticación y RBAC | `GET /vehicles`, `GET /admin/vehicles` | `401 Unauthorized` | PASS | `0.57 / 0.17 ms` |
| 5 | `TC-CORE-006` | Gestión de Usuarios | `POST /admin/users` | `201 Created` | PASS | `82.91 ms` |
| 6 | `TC-CORE-007` | Gestión de Usuarios | `POST /admin/users` (x2) | `400 Bad Request` | PASS | `1.01 / 0.53 ms` |
| 7 | `TC-CORE-008` | Gestión de Vehículos | `POST /admin/vehicles` | `201 Created` | PASS | `1.58 ms` |
| 8 | `TC-CORE-009` | Gestión de Vehículos | `POST /admin/vehicles` | `400 Bad Request` | PASS | `1.30 ms` |
| 9 | `TC-CORE-010` | Gestión de Vehículos | `POST /admin/vehicles` | `400 Bad Request` | PASS | `0.74 ms` |
| 10 | `TC-CORE-011` | Gestión de Vehículos | `GET /vehicles/available` | `200 OK` | PASS | `1.13 ms` |
| 11 | `TC-CORE-012` | Gestión de Vehículos | `PUT` + `DELETE /admin/vehicles/:id` | `200 OK` / `204 No Content` | PASS | `1.26 / 0.53 ms` |
| 12 | `TC-CORE-013` | Solicitudes de Flota | `POST /me/requests` | `201 Created` | PASS | `1.72 ms` |
| 13 | `TC-CORE-014` | Solicitudes de Flota | `POST /me/requests` | `400 Bad Request` | PASS | `0.51 ms` |





