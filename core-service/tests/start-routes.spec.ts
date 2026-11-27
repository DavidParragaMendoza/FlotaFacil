import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { eq, inArray, sql } from "drizzle-orm";
import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requests } from "@/domains/requests/schema";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { routes } from "@/domains/routes/schema";
import { ROUTE_STATUS } from "@/domains/routes/status";
import { USER_ROLES } from "@/domains/users/roles";
import { users } from "@/domains/users/schema";
import { vehicles } from "@/domains/vehicles/schema";
import { VEHICLE_STATUS } from "@/domains/vehicles/status";

vi.mock("@/use-cases/audit-log-service", () => ({ createAuditLog: vi.fn() }));

describe.skipIf(!process.env.TEST_DATABASE_URL)(
	"iniciar rota de solicitação aprovada (PostgreSQL de teste)",
	() => {
		const ids = {
			driver: randomUUID(),
			admin: randomUUID(),
			otherDriver: randomUUID(),
			vehicle: randomUUID(),
			otherVehicle: randomUUID(),
			request: randomUUID(),
			pendingRequest: randomUUID(),
			rejectedRequest: randomUUID(),
			startedRequest: randomUUID(),
			otherRequest: randomUUID(),
		};
		let app: ReturnType<typeof fastify> | undefined;
		let origin: string;
		let requestIds: string[];
		let vehicleIds: string[];
		let userIds: string[];
		let eventAbort: AbortController | undefined;
		let schemaReady = false;
		let db: typeof import("@/drizzle/client").db;
		let jwtPlugin: typeof import("@/plugins/jwt")["default"];
		let routeRouter: typeof import("@/routes/route-router").routeRouter;
		let routeEventRouter: typeof import("@/routes/route-event-router").routeEventRouter;
		let createAuditLog: typeof import("@/use-cases/audit-log-service").createAuditLog;

		beforeEach(async () => {
			const databaseUrl = process.env.TEST_DATABASE_URL;
			if (!databaseUrl)
				throw new Error("TEST_DATABASE_URL é obrigatório para esta spec");
			const parsedDatabaseUrl = new URL(databaseUrl);
			if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
				throw new Error("TEST_DATABASE_URL deve usar PostgreSQL");
			}
			const databaseName = decodeURIComponent(
				parsedDatabaseUrl.pathname.slice(1),
			);
			if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
				throw new Error(
					"O nome do banco em TEST_DATABASE_URL precisa conter 'test'",
				);
			}
			process.env.POSTGRES_USER = decodeURIComponent(
				parsedDatabaseUrl.username,
			);
			process.env.POSTGRES_PASSWORD = decodeURIComponent(
				parsedDatabaseUrl.password,
			);
			process.env.POSTGRES_HOST = parsedDatabaseUrl.hostname;
			process.env.POSTGRES_PORT = parsedDatabaseUrl.port || "5432";
			process.env.POSTGRES_DB = databaseName;

			({ db } = await import("@/drizzle/client.js"));
			jwtPlugin = (await import("@/plugins/jwt.js"))
				.default as unknown as typeof jwtPlugin;
			({ routeRouter } = await import("@/routes/route-router.js"));
			({ routeEventRouter } = await import("@/routes/route-event-router.js"));
			({ createAuditLog } = await import("@/use-cases/audit-log-service.js"));
			const schema = await db.execute(sql`
			SELECT
				to_regclass('public.users') AS users,
				to_regclass('public.vehicles') AS vehicles,
				to_regclass('public.requests') AS requests,
				to_regclass('public.routes') AS routes
		`);
			const schemaTables = schema.rows[0];
			const missingTables = ["users", "vehicles", "requests", "routes"].filter(
				(table) => !schemaTables?.[table],
			);
			if (missingTables.length > 0) {
				throw new Error(
					`O PostgreSQL de teste não tem as tabelas: ${missingTables.join(", ")}. ` +
						"Aplique as migrações com POSTGRES_DB apontando para o banco TEST_DATABASE_URL antes de executar esta spec.",
				);
			}
			schemaReady = true;
			vi.clearAllMocks();
			vi.mocked(createAuditLog).mockResolvedValue(undefined);
			requestIds = [
				ids.request,
				ids.pendingRequest,
				ids.rejectedRequest,
				ids.startedRequest,
				ids.otherRequest,
			];
			vehicleIds = [ids.vehicle, ids.otherVehicle];
			userIds = [ids.driver, ids.admin, ids.otherDriver];

			await db.insert(users).values([
				{
					id: ids.driver,
					name: "Motorista de teste",
					email: `${ids.driver}@example.test`,
					cpf: `1${ids.driver.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.driver.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999999",
					passwordHash: "test",
					role: USER_ROLES[0],
				},
				{
					id: ids.admin,
					name: "Admin de teste",
					email: `${ids.admin}@example.test`,
					cpf: `1${ids.admin.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.admin.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999998",
					passwordHash: "test",
					role: USER_ROLES[1],
				},
				{
					id: ids.otherDriver,
					name: "Outro motorista",
					email: `${ids.otherDriver}@example.test`,
					cpf: `1${ids.otherDriver.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.otherDriver.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999997",
					passwordHash: "test",
					role: USER_ROLES[0],
				},
			]);
			await db.insert(vehicles).values(
				vehicleIds.map((id, index) => ({
					id,
					plate: `TST${index}${id.replaceAll("-", "").slice(0, 3).toUpperCase()}`,
					model: "Veículo de teste",
					year: 2024,
					odometer: 100,
					status: VEHICLE_STATUS.AVAILABLE,
					type: "CAR" as const,
				})),
			);
			const start = new Date(Date.now() - 60_000);
			const end = new Date(Date.now() + 60 * 60_000);
			await db.insert(requests).values([
				{
					id: ids.request,
					userId: ids.driver,
					vehicleId: ids.vehicle,
					status: REQUEST_STATUS.APPROVED,
					predictedStartDate: start,
					predictedEndDate: end,
					destination: "Campus",
					reason: "Teste",
				},
				{
					id: ids.pendingRequest,
					userId: ids.driver,
					vehicleId: ids.vehicle,
					status: REQUEST_STATUS.PENDING,
					predictedStartDate: new Date(end.getTime() + 60_000),
					predictedEndDate: new Date(end.getTime() + 3_600_000),
					destination: "Campus",
					reason: "Teste",
				},
				{
					id: ids.rejectedRequest,
					userId: ids.driver,
					vehicleId: ids.vehicle,
					status: REQUEST_STATUS.REJECTED,
					predictedStartDate: new Date(end.getTime() + 4_200_000),
					predictedEndDate: new Date(end.getTime() + 7_800_000),
					destination: "Campus",
					reason: "Teste",
				},
				{
					id: ids.startedRequest,
					userId: ids.driver,
					vehicleId: ids.vehicle,
					status: REQUEST_STATUS.APPROVED,
					predictedStartDate: new Date(end.getTime() + 8_400_000),
					predictedEndDate: new Date(end.getTime() + 12_000_000),
					destination: "Campus",
					reason: "Teste",
				},
				{
					id: ids.otherRequest,
					userId: ids.otherDriver,
					vehicleId: ids.otherVehicle,
					status: REQUEST_STATUS.APPROVED,
					predictedStartDate: start,
					predictedEndDate: end,
					destination: "Campus",
					reason: "Teste",
				},
			]);
			await db.insert(routes).values([
				{
					id: randomUUID(),
					requestId: ids.request,
					status: ROUTE_STATUS.READY,
				},
				{
					id: randomUUID(),
					requestId: ids.pendingRequest,
					status: ROUTE_STATUS.READY,
				},
				{
					id: randomUUID(),
					requestId: ids.rejectedRequest,
					status: ROUTE_STATUS.READY,
				},
				{
					id: randomUUID(),
					requestId: ids.startedRequest,
					status: ROUTE_STATUS.READY,
				},
				{
					id: randomUUID(),
					requestId: ids.otherRequest,
					status: ROUTE_STATUS.READY,
				},
			]);

			app = fastify();
			app.setValidatorCompiler(validatorCompiler);
			app.setSerializerCompiler(serializerCompiler);
			await app.register(jwtPlugin);
			await app.register(routeRouter);
			await app.register(routeEventRouter);
			await app.listen({ host: "127.0.0.1", port: 0 });
			const address = app.server.address() as AddressInfo;
			origin = `http://127.0.0.1:${address.port}`;
		});

		afterEach(async () => {
			eventAbort?.abort();
			eventAbort = undefined;
			if (app) await app.close();
			app = undefined;
			if (!schemaReady) return;
			await db.delete(routes).where(inArray(routes.requestId, requestIds));
			await db.delete(requests).where(inArray(requests.id, requestIds));
			await db.delete(vehicles).where(inArray(vehicles.id, vehicleIds));
			await db.delete(users).where(inArray(users.id, userIds));
		});

		async function token(userId: string, role: string) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			return app.jwt.sign({ id: userId, role });
		}

		async function start(requestId: string, userId = ids.driver, auth = true) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			return app.inject({
				method: "POST",
				url: `/routes/${requestId}`,
				headers: auth
					? { authorization: `Bearer ${await token(userId, USER_ROLES[0])}` }
					: {},
			});
		}

		it("persiste STARTED no PostgreSQL e entrega route.started ao cliente SSE", async () => {
			eventAbort = new AbortController();
			const streamResponse = await fetch(`${origin}/admin/route-events`, {
				headers: {
					authorization: `Bearer ${await token(ids.admin, USER_ROLES[1])}`,
				},
				signal: eventAbort.signal,
			});
			expect(streamResponse.status).toBe(200);
			const reader = streamResponse.body?.getReader();
			expect(reader).toBeDefined();
			const connected = await reader?.read();
			expect(new TextDecoder().decode(connected?.value)).toContain(
				": connected",
			);

			const response = await start(ids.request);
			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({
				routeStatus: ROUTE_STATUS.STARTED,
				requestStatus: REQUEST_STATUS.APPROVED,
			});
			const eventChunk = await reader?.read();
			const eventText = new TextDecoder().decode(eventChunk?.value);
			expect(eventText).toContain("event: route.started");
			expect(eventText).toContain(`"routeId":"${response.json().id}"`);

			const [storedRoute] = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, ids.request));
			const [storedVehicle] = await db
				.select()
				.from(vehicles)
				.where(eq(vehicles.id, ids.vehicle));
			expect(storedRoute.status).toBe(ROUTE_STATUS.STARTED);
			expect(storedRoute.startedAt).toBeInstanceOf(Date);
			expect(storedVehicle.status).toBe(VEHICLE_STATUS.IN_USE);
			eventAbort.abort();
		});

		it("retorna 404 para solicitação inexistente sem criar rota", async () => {
			const missingRequestId = randomUUID();
			const response = await start(missingRequestId);
			expect(response.statusCode).toBe(404);
			expect(
				await db
					.select()
					.from(routes)
					.where(eq(routes.requestId, missingRequestId)),
			).toHaveLength(0);
		});

		it.each([
			REQUEST_STATUS.PENDING,
			REQUEST_STATUS.REJECTED,
		])("recusa solicitação %s sem iniciar a rota", async (status) => {
			const requestId =
				status === REQUEST_STATUS.PENDING
					? ids.pendingRequest
					: ids.rejectedRequest;
			const response = await start(requestId);
			expect(response.statusCode).toBe(400);
			const [stored] = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, requestId));
			expect(stored.status).toBe(ROUTE_STATUS.READY);
			expect(stored.startedAt).toBeNull();
		});

		it("recusa rota já iniciada sem criar uma segunda rota", async () => {
			await db
				.update(routes)
				.set({ status: ROUTE_STATUS.STARTED, startedAt: new Date() })
				.where(eq(routes.requestId, ids.startedRequest));
			const response = await start(ids.startedRequest);
			expect(response.statusCode).toBe(400);
			const stored = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, ids.startedRequest));
			expect(stored).toHaveLength(1);
			expect(stored[0].status).toBe(ROUTE_STATUS.STARTED);
		});

		it("retorna 401 sem JWT e mantém a rota pronta", async () => {
			const response = await start(ids.request, ids.driver, false);
			expect(response.statusCode).toBe(401);
			const [stored] = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, ids.request));
			expect(stored.status).toBe(ROUTE_STATUS.READY);
		});

		it("não permite iniciar solicitação de outro motorista", async () => {
			const response = await start(ids.otherRequest);
			expect([403, 404]).toContain(response.statusCode);
			const [stored] = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, ids.otherRequest));
			expect(stored.status).toBe(ROUTE_STATUS.READY);
			expect(stored.startedAt).toBeNull();
		});
	},
);
