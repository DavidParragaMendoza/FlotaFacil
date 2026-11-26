import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { REQUEST_STATUSES } from "@/domains/requests/status";
import { USER_ROLES } from "@/domains/users/roles";

vi.mock("@/messaging/client", () => ({
	connectRabbit: vi.fn(),
	getRabbitChannel: vi.fn(),
}));

vi.mock("@/messaging/setup", () => ({
	setupRabbit: vi.fn(),
}));

vi.mock("@/messaging/consumers", () => ({
	startRabbitConsumers: vi.fn(),
}));

vi.mock("@/domains/users/db/repository", () => ({
	deleteUserById: vi.fn(),
	fetchAdminUsers: vi.fn(),
	fetchUsers: vi.fn(),
	findUserAdminByCpf: vi.fn(),
	findUserByCpf: vi.fn(),
	findUserByEmail: vi.fn(),
	findUserByEmailAndRole: vi.fn(),
	findUserById: vi.fn(),
	insertUser: vi.fn(),
	updateUserById: vi.fn(),
}));

vi.mock("@/domains/vehicles/db/repository", () => ({
	deleteVehicle: vi.fn(),
	fetchAll: vi.fn(),
	fetchAllAvailable: vi.fn(),
	fetchAllRequestableForSchedule: vi.fn(),
	findById: vi.fn(),
	findByPlate: vi.fn(),
	insertVehicle: vi.fn(),
	updateVehicle: vi.fn(),
}));

vi.mock("@/domains/requests/db/repository", () => ({
	approveRequestWithScheduleChecks: vi.fn(),
	fetchRequests: vi.fn(),
	findActiveOrFutureRequestsByUserId: vi.fn(),
	findActiveOrFutureScheduleByVehicleId: vi.fn(),
	findRequestById: vi.fn(),
	findRequestsByVehicleId: vi.fn(),
	findVehicleScheduleConflict: vi.fn(),
	insertRequest: vi.fn(),
	insertRequestWithScheduleChecks: vi.fn(),
	updateRequestById: vi.fn(),
}));

vi.mock("@/use-cases/audit-log-service", () => ({
	createAuditLog: vi.fn(),
}));

vi.mock("@/use-cases/notification-service", () => ({
	notifyAdminsAboutNewRequest: vi.fn(),
	notifyDriverAboutRequestApproved: vi.fn(),
	notifyDriverAboutRequestRejected: vi.fn(),
}));

import { app } from "@/app";
import {
	findVehicleScheduleConflict,
	insertRequestWithScheduleChecks,
} from "@/domains/requests/db/repository";
import {
	findUserAdminByCpf,
	findUserByCpf,
	findUserByEmail,
	findUserById,
	insertUser,
} from "@/domains/users/db/repository";
import {
	deleteVehicle as deleteVehicleRepository,
	fetchAllRequestableForSchedule,
	fetchAll as fetchAllVehicles,
	findByPlate,
	findById as findVehicleById,
	insertVehicle,
	updateVehicle as updateVehicleRepository,
} from "@/domains/vehicles/db/repository";
import { VEHICLE_STATUSES } from "@/domains/vehicles/status";
import { authorize } from "@/hooks/authorize";
import { createAuditLog } from "@/use-cases/audit-log-service";
import { notifyAdminsAboutNewRequest } from "@/use-cases/notification-service";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "55555555-5555-4555-8555-555555555555";
const VEHICLE_ID = "66666666-6666-4666-8666-666666666666";
const BUSY_VEHICLE_ID = "77777777-7777-4777-8777-777777777777";
const fixedDate = new Date("2026-01-01T10:00:00.000Z");

function makeAdminUser(overrides = {}) {
	return {
		id: ADMIN_ID,
		name: "AdminSIF",
		email: "admin@sif.com",
		cpf: "00000000000",
		cnh: null,
		phone: "11999999999",
		photoUrl: null,
		department: "SIF",
		role: USER_ROLES[1],
		passwordHash: "hashed-password",
		createdAt: fixedDate,
		updatedAt: fixedDate,
		...overrides,
	};
}

function makeDriverUser(overrides = {}) {
	return {
		id: USER_ID,
		name: "Carlos Motorista",
		email: "carlos@sif.com",
		cpf: "12345678901",
		cnh: "12345678900",
		phone: "84999999999",
		photoUrl: null,
		department: "Transporte",
		role: USER_ROLES[0],
		passwordHash: "hashed-driver-password",
		createdAt: fixedDate,
		updatedAt: fixedDate,
		...overrides,
	};
}

function makeVehicle(overrides = {}) {
	return {
		id: VEHICLE_ID,
		plate: "ABC1D23",
		model: "Fiat Toro",
		year: 2024,
		odometer: 1200,
		imageUrl: null,
		status: VEHICLE_STATUSES[0],
		type: "CAR" as const,
		createdAt: fixedDate,
		updatedAt: fixedDate,
		...overrides,
	};
}

function makeRequest(overrides = {}) {
	return {
		id: REQUEST_ID,
		userId: USER_ID,
		vehicleId: VEHICLE_ID,
		approvedBy: null,
		status: REQUEST_STATUSES[0],
		predictedStartDate: new Date("2026-03-15T08:00:00.000Z"),
		predictedEndDate: new Date("2026-03-15T12:00:00.000Z"),
		destination: "Campus Pau dos Ferros",
		reason: "Visita técnica institucional",
		createdAt: fixedDate,
		updatedAt: fixedDate,
		...overrides,
	};
}

function getAdminAuthHeader() {
	const token = app.jwt.sign({
		id: ADMIN_ID,
		role: USER_ROLES[1],
	});
	return { authorization: `Bearer ${token}` };
}

function getDriverAuthHeader() {
	const token = app.jwt.sign({
		id: USER_ID,
		role: USER_ROLES[0],
	});
	return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
	await app.ready();
});

afterAll(async () => {
	await app.close();
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("Casos de Prueba core-service — David Párraga", () => {
	describe("1. Autenticación y RBAC", () => {
		it("TC-CORE-001: Login de administrador válido (POST /admin/auth -> 200, JWT)", async () => {
			const passwordHash = await bcrypt.hash("123456", 10);
			vi.mocked(findUserAdminByCpf).mockResolvedValue(
				makeAdminUser({ passwordHash }),
			);

			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "00000000000",
					password: "123456",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(findUserAdminByCpf).toHaveBeenCalledTimes(1);
			expect(findUserAdminByCpf).toHaveBeenCalledWith("00000000000");

			const body = response.json();
			expect(body).toHaveProperty("token");
			expect(typeof body.token).toBe("string");
			expect(body.token.length).toBeGreaterThan(0);

			expect(body.user).toEqual({
				id: ADMIN_ID,
				name: "AdminSIF",
				email: "admin@sif.com",
				photoUrl: null,
				role: "admin",
			});
			expect(body.user).not.toHaveProperty("passwordHash");

			const decodedToken = app.jwt.verify<{ id: string; role: string }>(
				body.token,
			);
			expect(decodedToken).toMatchObject({
				id: ADMIN_ID,
				role: "admin",
			});
		});

		it("TC-CORE-001 (mutación - admin no encontrado): rechaza login con 401 cuando el CPF no existe", async () => {
			vi.mocked(findUserAdminByCpf).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "00000000000",
					password: "123456",
				},
			});

			expect(response.statusCode).toBe(401);
			expect(findUserAdminByCpf).toHaveBeenCalledTimes(1);
			expect(findUserAdminByCpf).toHaveBeenCalledWith("00000000000");

			const body = response.json();
			expect(body).toEqual({
				message: "Credenciais inválidas",
			});
			expect(body).not.toHaveProperty("token");
		});

		it("TC-CORE-001 (mutación - contraseña incorrecta): rechaza login con 401 cuando la contraseña no coincide", async () => {
			const passwordHash = await bcrypt.hash("123456", 10);
			vi.mocked(findUserAdminByCpf).mockResolvedValue(
				makeAdminUser({ passwordHash }),
			);

			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "00000000000",
					password: "senha-incorrecta",
				},
			});

			expect(response.statusCode).toBe(401);
			expect(findUserAdminByCpf).toHaveBeenCalledTimes(1);
			expect(findUserAdminByCpf).toHaveBeenCalledWith("00000000000");

			const body = response.json();
			expect(body).toEqual({
				message: "Credenciais inválidas",
			});
			expect(body).not.toHaveProperty("token");
		});

		it("TC-CORE-002: Campos de login vacíos (POST /admin/auth -> 400)", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "",
					password: "",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(findUserAdminByCpf).not.toHaveBeenCalled();

			const body = response.json();
			expect(body).not.toHaveProperty("token");
			expect(body).toHaveProperty("message");
			expect(body.message).toContain("cpf");
			expect(body.message).toContain("password");
		});

		it("TC-CORE-002 (aislamiento - solo cpf vacío): rechaza con 400 identificando únicamente cpf", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "",
					password: "123456",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(findUserAdminByCpf).not.toHaveBeenCalled();

			const body = response.json();
			expect(body).not.toHaveProperty("token");
			expect(body.message).toContain("cpf");
			expect(body.message).not.toContain("password");
		});

		it("TC-CORE-002 (aislamiento - solo password vacío): rechaza con 400 identificando únicamente password", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf: "00000000000",
					password: "",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(findUserAdminByCpf).not.toHaveBeenCalled();

			const body = response.json();
			expect(body).not.toHaveProperty("token");
			expect(body.message).toContain("password");
			expect(body.message).not.toContain("cpf");
		});

		it("TC-CORE-002 (aislamiento - campos obligatorios ausentes): rechaza {} con 400 identificando cpf y password", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {},
			});

			expect(response.statusCode).toBe(400);
			expect(findUserAdminByCpf).not.toHaveBeenCalled();

			const body = response.json();
			expect(body).not.toHaveProperty("token");
			expect(body.message).toContain("cpf");
			expect(body.message).toContain("password");
		});

		it.each([
			{
				label: "frontera inferior - 10 dígitos",
				cpf: "1234567890",
			},
			{
				label: "frontera superior - 12 dígitos",
				cpf: "123456789012",
			},
			{
				label: "11 chars - no numérico al final",
				cpf: "1234567890a",
			},
			{
				label: "11 chars - no numérico al inicio (mata mutante regex ^)",
				cpf: "a1234567890",
			},
			{
				label: "11 chars - no numérico en el medio",
				cpf: "12345a67890",
			},
			{
				label: "11 chars - espacio interno",
				cpf: "12345 67890",
			},
			{
				label: "formato con puntuación no numérica",
				cpf: "000.000.000-00",
			},
		])("TC-CORE-003 ($label): rechaza CPF '$cpf' con 400 sin emitir token", async ({
			cpf,
		}) => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/auth",
				payload: {
					cpf,
					password: "123456",
				},
			});

			expect(response.statusCode).toBe(400);

			const body = response.json();
			expect(body).not.toHaveProperty("token");
			expect(body).toHaveProperty("message");
			expect(body.message).toContain("cpf");
			expect(findUserAdminByCpf).not.toHaveBeenCalled();
		});

		it.each([
			{ url: "/vehicles", description: "ruta protegida general" },
			{ url: "/admin/vehicles", description: "ruta protegida administrativa" },
		])("TC-CORE-005 ($description): GET $url sin cabecera Authorization responde 401 sin consultar repositorio", async ({
			url,
		}) => {
			const response = await app.inject({
				method: "GET",
				url,
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toEqual({
				error: "Token inválido ou expirado",
			});
			expect(fetchAllVehicles).not.toHaveBeenCalled();
		});

		it("TC-CORE-005 (token malformado): rechaza Bearer inválido con 401 sin consultar repositorio", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/admin/vehicles",
				headers: {
					authorization: "Bearer token.invalido.malformado",
				},
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toEqual({
				error: "Token inválido ou expirado",
			});
			expect(fetchAllVehicles).not.toHaveBeenCalled();
		});

		it("TC-CORE-005 (token expirado): rechaza JWT vencido con 401 sin consultar repositorio", async () => {
			const expiredToken = app.jwt.sign(
				{
					id: ADMIN_ID,
					role: USER_ROLES[1],
				},
				{ expiresIn: -10 },
			);

			const response = await app.inject({
				method: "GET",
				url: "/admin/vehicles",
				headers: {
					authorization: `Bearer ${expiredToken}`,
				},
			});

			expect(response.statusCode).toBe(401);
			expect(response.json()).toEqual({
				error: "Token inválido ou expirado",
			});
			expect(fetchAllVehicles).not.toHaveBeenCalled();
		});

		it("TC-CORE-005 (mutación RBAC - rol driver en /admin/vehicles): hook authorize bloquea con 403", async () => {
			const response = await app.inject({
				method: "GET",
				url: "/admin/vehicles",
				headers: getDriverAuthHeader(),
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).toEqual({
				error: "Sem permissão",
			});
			expect(fetchAllVehicles).not.toHaveBeenCalled();
		});

		it("TC-CORE-005 (mutación RBAC - defensa sin request.user): hook authorize responde 401 Não autenticado", async () => {
			const guard = authorize([USER_ROLES[1]]);
			const send = vi.fn();
			const status = vi.fn().mockReturnValue({ send });
			const fakeRequest = {} as FastifyRequest;
			const fakeReply = { status } as unknown as FastifyReply;

			await guard(fakeRequest, fakeReply);

			expect(status).toHaveBeenCalledWith(401);
			expect(send).toHaveBeenCalledWith({
				error: "Não autenticado",
			});
		});
	});

	describe("2. Gestión de Usuarios", () => {
		it("TC-CORE-006: Registro de usuario con datos válidos (POST /admin/users -> 201 y GET /admin/users/:id -> 200)", async () => {
			let createdUserRecord: ReturnType<typeof makeDriverUser> | undefined;
			vi.mocked(findUserByEmail).mockResolvedValue(undefined);
			vi.mocked(findUserByCpf).mockResolvedValue(undefined);
			vi.mocked(insertUser).mockImplementation(async (data) => {
				createdUserRecord = makeDriverUser({
					...data,
					passwordHash: data.passwordHash,
				});
				return createdUserRecord;
			});
			vi.mocked(findUserById).mockImplementation(async (id) =>
				createdUserRecord && createdUserRecord.id === id
					? createdUserRecord
					: undefined,
			);

			// Paso 1: POST /admin/users
			const response = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "Carlos Motorista",
					email: "carlos@sif.com",
					password: "driverPassword123",
					cpf: "12345678901",
					cnh: "12345678900",
					phone: "84999999999",
					department: "Transporte",
					role: "driver",
				},
			});

			expect(response.statusCode).toBe(201);
			expect(findUserByEmail).toHaveBeenCalledWith("carlos@sif.com");
			expect(findUserByCpf).toHaveBeenCalledWith("12345678901");
			expect(insertUser).toHaveBeenCalledTimes(1);

			const insertedPayload = vi.mocked(insertUser).mock.calls[0][0];
			expect(insertedPayload.passwordHash).not.toBe("driverPassword123");
			expect(
				await bcrypt.compare("driverPassword123", insertedPayload.passwordHash),
			).toBe(true);

			const body = response.json();
			expect(body).toMatchObject({
				id: USER_ID,
				name: "Carlos Motorista",
				email: "carlos@sif.com",
				cpf: "12345678901",
				cnh: "12345678900",
				phone: "84999999999",
				department: "Transporte",
				role: "driver",
			});
			expect(body).not.toHaveProperty("passwordHash");
			expect(body).not.toHaveProperty("password");

			expect(createAuditLog).toHaveBeenCalledWith({
				action: "USER.CREATED",
				entityId: USER_ID,
				performedBy: ADMIN_ID,
			});

			// Paso 2 (Roteiro PDF): GET /admin/users/:id
			const getResponse = await app.inject({
				method: "GET",
				url: `/admin/users/${body.id}`,
				headers: getAdminAuthHeader(),
			});

			expect(getResponse.statusCode).toBe(200);
			expect(findUserById).toHaveBeenCalledWith(USER_ID);
			const fetchedUser = getResponse.json();
			expect(fetchedUser).toMatchObject({
				id: USER_ID,
				name: "Carlos Motorista",
				email: "carlos@sif.com",
				cpf: "12345678901",
				role: "driver",
			});
			expect(fetchedUser).not.toHaveProperty("passwordHash");
			expect(fetchedUser).not.toHaveProperty("password");
		});

		it("TC-CORE-006 (mutación - CPF duplicado): rechaza creación con 400 sin insertar ni auditar", async () => {
			vi.mocked(findUserByEmail).mockResolvedValue(undefined);
			vi.mocked(findUserByCpf).mockResolvedValue(makeDriverUser());

			const response = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "Carlos Motorista",
					email: "nuevo@sif.com",
					password: "driverPassword123",
					cpf: "12345678901",
					phone: "84999999999",
					role: "driver",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				message: "CPF já está em uso",
			});
			expect(insertUser).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it("TC-CORE-006 (mutación - email duplicado): rechaza creación con 400 sin insertar ni auditar", async () => {
			vi.mocked(findUserByEmail).mockResolvedValue(makeDriverUser());
			vi.mocked(findUserByCpf).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "Carlos Motorista",
					email: "carlos@sif.com",
					password: "driverPassword123",
					cpf: "98765432100",
					phone: "84999999999",
					role: "driver",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				message: "E-mail já está em uso",
			});
			expect(insertUser).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it("TC-CORE-006 (mutación - GET /admin/users/:id inexistente): responde 404 Usuário não encontrado", async () => {
			vi.mocked(findUserById).mockResolvedValue(undefined);

			const response = await app.inject({
				method: "GET",
				url: `/admin/users/${USER_ID}`,
				headers: getAdminAuthHeader(),
			});

			expect(response.statusCode).toBe(404);
			expect(findUserById).toHaveBeenCalledWith(USER_ID);
			expect(response.json()).toEqual({
				message: "Usuário não encontrado",
			});
		});

		it("TC-CORE-007: E-mail inválido y campos obligatorios vacíos (POST /admin/users -> 400)", async () => {
			// Paso 1: Enviar name, email y password vacíos
			const emptyFieldsResponse = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "",
					email: "",
					password: "",
					cpf: "12345678901",
					phone: "84999999999",
				},
			});

			expect(emptyFieldsResponse.statusCode).toBe(400);
			const emptyFieldsBody = emptyFieldsResponse.json();
			expect(emptyFieldsBody.message).toContain("name");
			expect(emptyFieldsBody.message).toContain("email");
			expect(emptyFieldsBody.message).toContain("password");

			// Paso 2: Repetir con formato de e-mail inválido
			const invalidEmailResponse = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "Carlos Motorista",
					email: "correo-invalido-sin-arroba",
					password: "driverPassword123",
					cpf: "12345678901",
					phone: "84999999999",
				},
			});

			expect(invalidEmailResponse.statusCode).toBe(400);
			const invalidEmailBody = invalidEmailResponse.json();
			expect(invalidEmailBody.message).toContain("email");

			expect(findUserByEmail).not.toHaveBeenCalled();
			expect(findUserByCpf).not.toHaveBeenCalled();
			expect(insertUser).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it("TC-CORE-007 (campos obligatorios ausentes): rechaza {} con 400 sin tocar repositorios", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {},
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(body.message).toContain("name");
			expect(body.message).toContain("email");
			expect(body.message).toContain("password");
			expect(body.message).toContain("cpf");
			expect(body.message).toContain("phone");

			expect(findUserByEmail).not.toHaveBeenCalled();
			expect(findUserByCpf).not.toHaveBeenCalled();
			expect(insertUser).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it.each([
			{
				label: "cpf frontera inferior (10 chars)",
				field: "cpf",
				overrides: { cpf: "1234567890" },
			},
			{
				label: "cpf frontera superior (12 chars)",
				field: "cpf",
				overrides: { cpf: "123456789012" },
			},
			{
				label: "cnh frontera inferior (10 chars)",
				field: "cnh",
				overrides: { cnh: "1234567890" },
			},
			{
				label: "cnh frontera superior (12 chars)",
				field: "cnh",
				overrides: { cnh: "123456789012" },
			},
		])("TC-CORE-007 (mutación contrato - $label): rechaza con 400 identificando $field", async ({
			field,
			overrides,
		}) => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/users",
				headers: getAdminAuthHeader(),
				payload: {
					name: "Carlos Motorista",
					email: "carlos@sif.com",
					password: "driverPassword123",
					cpf: "12345678901",
					phone: "84999999999",
					...overrides,
				},
			});

			expect(response.statusCode).toBe(400);
			expect(response.json().message).toContain(field);
			expect(findUserByEmail).not.toHaveBeenCalled();
			expect(findUserByCpf).not.toHaveBeenCalled();
			expect(insertUser).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});
	});

	describe("3. Gestión de Vehículos", () => {
		it("TC-CORE-008: Registrar vehículo válido (POST /admin/vehicles -> 201 y visible en GET /admin/vehicles -> 200)", async () => {
			const storedVehicles: ReturnType<typeof makeVehicle>[] = [];
			vi.mocked(findByPlate).mockResolvedValue(undefined);
			vi.mocked(insertVehicle).mockImplementation(async (data) => {
				const created = makeVehicle({
					...data,
					imageUrl: data.imageUrl ?? null,
				});
				storedVehicles.push(created);
				return created;
			});
			vi.mocked(fetchAllVehicles).mockImplementation(
				async () => storedVehicles,
			);

			// Paso 1: POST /admin/vehicles
			const response = await app.inject({
				method: "POST",
				url: "/admin/vehicles",
				headers: getAdminAuthHeader(),
				payload: {
					plate: "ABC1D23",
					model: "Fiat Toro",
					year: 2024,
					odometer: 1200,
					imageUrl: null,
					status: "AVAILABLE",
					type: "CAR",
				},
			});

			expect(response.statusCode).toBe(201);
			expect(findByPlate).toHaveBeenCalledWith("ABC1D23");
			expect(insertVehicle).toHaveBeenCalledWith({
				plate: "ABC1D23",
				model: "Fiat Toro",
				year: 2024,
				odometer: 1200,
				imageUrl: null,
				status: "AVAILABLE",
				type: "CAR",
			});

			const body = response.json();
			expect(body).toMatchObject({
				id: VEHICLE_ID,
				plate: "ABC1D23",
				model: "Fiat Toro",
				year: 2024,
				odometer: 1200,
				imageUrl: null,
				status: "AVAILABLE",
				type: "CAR",
			});

			expect(createAuditLog).toHaveBeenCalledWith({
				action: "VEHICLE.CREATED",
				entityId: VEHICLE_ID,
				performedBy: ADMIN_ID,
			});

			// Verificación exigida en PDF: visible en GET /admin/vehicles
			const listResponse = await app.inject({
				method: "GET",
				url: "/admin/vehicles",
				headers: getAdminAuthHeader(),
			});

			expect(listResponse.statusCode).toBe(200);
			expect(fetchAllVehicles).toHaveBeenCalledTimes(1);
			const listBody = listResponse.json();
			expect(listBody).toHaveLength(1);
			expect(listBody[0]).toMatchObject({
				id: VEHICLE_ID,
				plate: "ABC1D23",
				model: "Fiat Toro",
				year: 2024,
				odometer: 1200,
				imageUrl: null,
				status: "AVAILABLE",
				type: "CAR",
			});
		});

		it("TC-CORE-009: Registro de vehículo con placa duplicada (POST /admin/vehicles -> 409/400)", async () => {
			vi.mocked(findByPlate).mockResolvedValue(makeVehicle());

			const response = await app.inject({
				method: "POST",
				url: "/admin/vehicles",
				headers: getAdminAuthHeader(),
				payload: {
					plate: "ABC1D23",
					model: "Fiat Toro",
					year: 2024,
					odometer: 1200,
					imageUrl: null,
					status: "AVAILABLE",
					type: "CAR",
				},
			});

			expect([400, 409]).toContain(response.statusCode);
			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({
				message: "A placa desse veículo já foi registrada",
			});
			expect(insertVehicle).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it("TC-CORE-010: Enums y tipos de datos inválidos (POST /admin/vehicles -> 400)", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/admin/vehicles",
				headers: getAdminAuthHeader(),
				payload: {
					plate: "ABC1D23",
					model: "Fiat Toro",
					year: "dos-mil-veinticuatro",
					odometer: "mil-doscientos",
					imageUrl: null,
					status: "STATUS_INEXISTENTE",
					type: "NAVE_ESPACIAL",
				},
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(body.message).toContain("year");
			expect(body.message).toContain("odometer");
			expect(body.message).toContain("status");
			expect(body.message).toContain("type");

			expect(findByPlate).not.toHaveBeenCalled();
			expect(insertVehicle).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
		});

		it("TC-CORE-011: Listado de vehículos disponibles por fecha (GET /vehicles/available -> 200)", async () => {
			const freeVehicle = makeVehicle({
				id: VEHICLE_ID,
				plate: "ABC1D23",
				model: "Fiat Toro",
			});
			const busyVehicle = makeVehicle({
				id: BUSY_VEHICLE_ID,
				plate: "XYZ9K88",
				model: "Toyota Hilux",
			});

			vi.mocked(fetchAllRequestableForSchedule).mockResolvedValue([
				freeVehicle,
				busyVehicle,
			]);
			vi.mocked(findVehicleScheduleConflict).mockImplementation(
				async ({ vehicleId }) =>
					vehicleId === BUSY_VEHICLE_ID
						? makeRequest({ vehicleId: BUSY_VEHICLE_ID })
						: undefined,
			);

			const response = await app.inject({
				method: "GET",
				url: "/vehicles/available?predictedStartDate=2026-03-10T08:00:00.000Z&predictedEndDate=2026-03-10T18:00:00.000Z",
				headers: getDriverAuthHeader(),
			});

			expect(response.statusCode).toBe(200);
			expect(fetchAllRequestableForSchedule).toHaveBeenCalledTimes(1);
			expect(findVehicleScheduleConflict).toHaveBeenCalledTimes(2);

			const body = response.json();
			expect(body).toHaveLength(1);
			expect(body[0]).toMatchObject({
				id: VEHICLE_ID,
				plate: "ABC1D23",
				model: "Fiat Toro",
				status: "AVAILABLE",
			});
		});

		it("TC-CORE-012: Actualizar (PUT /admin/vehicles/:id -> 200) y eliminar vehículo (DELETE -> 204)", async () => {
			// Paso 1: Actualizar vehículo (PUT /admin/vehicles/:id -> 200)
			vi.mocked(findVehicleById).mockResolvedValue(makeVehicle());
			vi.mocked(findByPlate).mockResolvedValue(makeVehicle());
			vi.mocked(updateVehicleRepository).mockResolvedValue(
				makeVehicle({
					model: "Fiat Toro Ultra",
					odometer: 2500,
				}),
			);

			const putResponse = await app.inject({
				method: "PUT",
				url: `/admin/vehicles/${VEHICLE_ID}`,
				headers: getAdminAuthHeader(),
				payload: {
					plate: "ABC1D23",
					model: "Fiat Toro Ultra",
					year: 2024,
					odometer: 2500,
					imageUrl: null,
					status: "AVAILABLE",
					type: "CAR",
				},
			});

			expect(putResponse.statusCode).toBe(200);
			expect(putResponse.json()).toMatchObject({
				id: VEHICLE_ID,
				plate: "ABC1D23",
				model: "Fiat Toro Ultra",
				odometer: 2500,
			});
			expect(createAuditLog).toHaveBeenCalledWith({
				action: "VEHICLE.UPDATED",
				entityId: VEHICLE_ID,
				performedBy: ADMIN_ID,
			});

			// Paso 2: Eliminar vehículo (DELETE /admin/vehicles/:id -> 204)
			vi.mocked(deleteVehicleRepository).mockResolvedValue(makeVehicle());

			const deleteResponse = await app.inject({
				method: "DELETE",
				url: `/admin/vehicles/${VEHICLE_ID}`,
				headers: getAdminAuthHeader(),
			});

			expect(deleteResponse.statusCode).toBe(204);
			expect(deleteVehicleRepository).toHaveBeenCalledWith(VEHICLE_ID);
			expect(createAuditLog).toHaveBeenCalledWith({
				action: "VEHICLE.DELETED",
				entityId: VEHICLE_ID,
				performedBy: ADMIN_ID,
			});
		});
	});

	describe("4. Solicitudes de Flota (Fase Inicial)", () => {
		it("TC-CORE-013: Crear solicitud propia válida (POST /me/requests -> 201)", async () => {
			const requestEntity = makeRequest();
			vi.mocked(findUserById).mockResolvedValue(makeDriverUser());
			vi.mocked(findVehicleById).mockResolvedValue(makeVehicle());
			vi.mocked(insertRequestWithScheduleChecks).mockResolvedValue({
				request: requestEntity,
			});

			const response = await app.inject({
				method: "POST",
				url: "/me/requests",
				headers: getDriverAuthHeader(),
				payload: {
					vehicleId: VEHICLE_ID,
					predictedStartDate: "2026-03-15T08:00:00.000Z",
					predictedEndDate: "2026-03-15T12:00:00.000Z",
					destination: "Campus Pau dos Ferros",
					reason: "Visita técnica institucional",
				},
			});

			expect(response.statusCode).toBe(201);
			expect(insertRequestWithScheduleChecks).toHaveBeenCalledWith({
				userId: USER_ID,
				vehicleId: VEHICLE_ID,
				status: "PENDING",
				predictedStartDate: new Date("2026-03-15T08:00:00.000Z"),
				predictedEndDate: new Date("2026-03-15T12:00:00.000Z"),
				destination: "Campus Pau dos Ferros",
				reason: "Visita técnica institucional",
			});

			const body = response.json();
			expect(body).toMatchObject({
				id: REQUEST_ID,
				userId: USER_ID,
				vehicleId: VEHICLE_ID,
				status: "PENDING",
				destination: "Campus Pau dos Ferros",
				reason: "Visita técnica institucional",
				vehicle: {
					id: VEHICLE_ID,
					plate: "ABC1D23",
					model: "Fiat Toro",
				},
			});

			expect(createAuditLog).toHaveBeenCalledWith({
				action: "REQUEST.CREATED",
				entityId: REQUEST_ID,
				performedBy: USER_ID,
			});
			expect(notifyAdminsAboutNewRequest).toHaveBeenCalledWith(REQUEST_ID);
		});

		it("TC-CORE-014: Campos obligatorios vacíos en solicitud (POST /me/requests -> 400)", async () => {
			const response = await app.inject({
				method: "POST",
				url: "/me/requests",
				headers: getDriverAuthHeader(),
				payload: {
					predictedStartDate: "2026-03-15T08:00:00.000Z",
					predictedEndDate: "2026-03-15T12:00:00.000Z",
					destination: "",
					reason: "",
				},
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(body.message).toContain("vehicleId");
			expect(body.message).toContain("destination");
			expect(body.message).toContain("reason");

			expect(insertRequestWithScheduleChecks).not.toHaveBeenCalled();
			expect(createAuditLog).not.toHaveBeenCalled();
			expect(notifyAdminsAboutNewRequest).not.toHaveBeenCalled();
		});
	});
});
