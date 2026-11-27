import { randomUUID } from "node:crypto";
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
vi.mock("@/use-cases/reports/generate-route-report", () => ({
	generateRouteReportUseCase: vi.fn().mockResolvedValue("Relatório de teste"),
}));

describe.skipIf(!process.env.TEST_DATABASE_URL)(
	"finalizar rota iniciada (PostgreSQL de teste)",
	() => {
		const ids = {
			user: randomUUID(),
			otherUser: randomUUID(),
			vehicle: randomUUID(),
			otherVehicle: randomUUID(),
			valid: randomUUID(),
			emptyDescription: randomUUID(),
			missingDescription: randomUUID(),
			missingRoute: randomUUID(),
			notStarted: randomUUID(),
			finished: randomUUID(),
			otherUsersRoute: randomUUID(),
		};
		const requestIds = [
			ids.valid,
			ids.emptyDescription,
			ids.missingDescription,
			ids.notStarted,
			ids.finished,
			ids.otherUsersRoute,
		];
		let app: ReturnType<typeof fastify> | undefined;
		let db: typeof import("@/drizzle/client").db;
		let jwtPlugin: typeof import("@/plugins/jwt")["default"];
		let routeRouter: typeof import("@/routes/route-router").routeRouter;
		let schemaReady = false;

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

			await db.insert(users).values([
				{
					id: ids.user,
					name: "Motorista de teste",
					email: `${ids.user}@example.test`,
					cpf: `1${ids.user.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.user.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999999",
					passwordHash: "test",
					role: USER_ROLES[0],
				},
				{
					id: ids.otherUser,
					name: "Outro motorista",
					email: `${ids.otherUser}@example.test`,
					cpf: `1${ids.otherUser.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.otherUser.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999998",
					passwordHash: "test",
					role: USER_ROLES[0],
				},
			]);
			await db.insert(vehicles).values([
				{
					id: ids.vehicle,
					plate: `TST${ids.vehicle
						.replaceAll("-", "")
						.slice(0, 4)
						.toUpperCase()}`,
					model: "Veículo de teste",
					year: 2024,
					odometer: 100,
					status: VEHICLE_STATUS.IN_USE,
					type: "CAR",
				},
				{
					id: ids.otherVehicle,
					plate: `TST${ids.otherVehicle
						.replaceAll("-", "")
						.slice(0, 4)
						.toUpperCase()}`,
					model: "Outro veículo de teste",
					year: 2024,
					odometer: 100,
					status: VEHICLE_STATUS.IN_USE,
					type: "CAR",
				},
			]);
			const startDate = new Date(Date.now() - 60_000);
			const endDate = new Date(Date.now() + 60 * 60_000);
			await db.insert(requests).values(
				requestIds.map((id, index) => ({
					id,
					userId: id === ids.otherUsersRoute ? ids.otherUser : ids.user,
					vehicleId:
						id === ids.otherUsersRoute ? ids.otherVehicle : ids.vehicle,
					status: REQUEST_STATUS.APPROVED,
					predictedStartDate: new Date(startDate.getTime() + index * 60_000),
					predictedEndDate: new Date(endDate.getTime() + index * 60_000),
					destination: "Campus",
					reason: "Teste",
				})),
			);
			await db.insert(routes).values(
				requestIds.map((requestId) => ({
					requestId,
					status:
						requestId === ids.notStarted
							? ROUTE_STATUS.READY
							: requestId === ids.finished
								? ROUTE_STATUS.FINISHED
								: ROUTE_STATUS.STARTED,
					startedAt: new Date(Date.now() - 30 * 60_000),
					description:
						requestId === ids.finished ? "Descrição já existente" : null,
					finishedAt:
						requestId === ids.finished
							? new Date(Date.now() - 5 * 60_000)
							: null,
				})),
			);

			app = fastify();
			app.setValidatorCompiler(validatorCompiler);
			app.setSerializerCompiler(serializerCompiler);
			await app.register(jwtPlugin);
			await app.register(routeRouter);
			await app.listen({ host: "127.0.0.1", port: 0 });
		});

		afterEach(async () => {
			if (app) await app.close();
			app = undefined;
			if (!schemaReady) return;
			await db.delete(routes).where(inArray(routes.requestId, requestIds));
			await db.delete(requests).where(inArray(requests.id, requestIds));
			await db
				.delete(vehicles)
				.where(inArray(vehicles.id, [ids.vehicle, ids.otherVehicle]));
			await db
				.delete(users)
				.where(inArray(users.id, [ids.user, ids.otherUser]));
		});

		async function token(userId: string = ids.user) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			return app.jwt.sign({ id: userId, role: USER_ROLES[0] });
		}

		async function finish(
			requestId: string,
			options: {
				auth?: boolean;
				userId?: string;
				body?: Record<string, unknown>;
			} = {},
		) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			const headers =
				options.auth === false
					? {}
					: { authorization: `Bearer ${await token(options.userId)}` };
			return app.inject({
				method: "PATCH",
				url: `/me/trips/${requestId}/finish`,
				headers,
				...(options.body === undefined ? {} : { payload: options.body }),
			});
		}

		async function finishRequestRoute(
			requestId: string,
			options: {
				auth?: boolean;
				userId?: string;
				body?: Record<string, unknown>;
			} = {},
		) {
			const [route] = await db
				.select({ id: routes.id })
				.from(routes)
				.where(eq(routes.requestId, requestId));
			return finish(route?.id ?? requestId, options);
		}

		async function storedRoute(requestId: string) {
			const [stored] = await db
				.select()
				.from(routes)
				.where(eq(routes.requestId, requestId));
			return stored;
		}

		it("finaliza rota com descrição válida e persiste data e descrição", async () => {
			const description = "Viagem concluída sem ocorrências";
			const response = await finishRequestRoute(ids.valid, {
				body: { description },
			});
			expect(response.statusCode).toBe(200);
			expect(response.json()).toMatchObject({
				routeStatus: ROUTE_STATUS.FINISHED,
				description,
				finishedAt: expect.any(String),
			});
			const stored = await storedRoute(ids.valid);
			expect(stored.status).toBe(ROUTE_STATUS.FINISHED);
			expect(stored.finishedAt).toBeInstanceOf(Date);
			expect(stored.description).toBe(description);
		});

		it("retorna 400 para descrição vazia e mantém a rota iniciada", async () => {
			const response = await finishRequestRoute(ids.emptyDescription, {
				body: { description: "   " },
			});
			expect(response.statusCode).toBe(400);
			const stored = await storedRoute(ids.emptyDescription);
			expect(stored.status).toBe(ROUTE_STATUS.STARTED);
			expect(stored.finishedAt).toBeNull();
			expect(stored.description).toBeNull();
		});

		it("retorna 400 quando description está ausente e mantém a rota iniciada", async () => {
			const response = await finishRequestRoute(ids.missingDescription, {
				body: {},
			});
			expect(response.statusCode).toBe(400);
			const stored = await storedRoute(ids.missingDescription);
			expect(stored.status).toBe(ROUTE_STATUS.STARTED);
			expect(stored.finishedAt).toBeNull();
			expect(stored.description).toBeNull();
		});

		it("retorna 404 para rota inexistente sem alterar o banco", async () => {
			const response = await finish(ids.missingRoute, {
				body: { description: "Finalização" },
			});
			expect(response.statusCode).toBe(404);
			expect(
				await db.select().from(routes).where(eq(routes.id, ids.missingRoute)),
			).toHaveLength(0);
		});

		it("retorna 400 e preserva rota que ainda não foi iniciada", async () => {
			const before = await storedRoute(ids.notStarted);
			const response = await finishRequestRoute(ids.notStarted, {
				body: { description: "Finalização" },
			});
			expect(response.statusCode).toBe(400);
			const after = await storedRoute(ids.notStarted);
			expect(after.status).toBe(ROUTE_STATUS.READY);
			expect(after.startedAt?.getTime()).toBe(before.startedAt?.getTime());
			expect(after.finishedAt).toBe(before.finishedAt);
			expect(after.description).toBe(before.description);
		});

		it("retorna 400 e preserva rota já finalizada", async () => {
			const before = await storedRoute(ids.finished);
			const response = await finishRequestRoute(ids.finished, {
				body: { description: "Nova descrição" },
			});
			expect(response.statusCode).toBe(400);
			const after = await storedRoute(ids.finished);
			expect(after.status).toBe(ROUTE_STATUS.FINISHED);
			expect(after.finishedAt?.getTime()).toBe(before.finishedAt?.getTime());
			expect(after.description).toBe("Descrição já existente");
		});

		it("retorna 401 sem JWT e mantém a rota iniciada", async () => {
			const response = await finishRequestRoute(ids.valid, {
				auth: false,
				body: { description: "Finalização" },
			});
			expect(response.statusCode).toBe(401);
			const stored = await storedRoute(ids.valid);
			expect(stored.status).toBe(ROUTE_STATUS.STARTED);
			expect(stored.finishedAt).toBeNull();
			expect(stored.description).toBeNull();
		});

		it("retorna 404 e preserva rota pertencente a outro usuário", async () => {
			const before = await storedRoute(ids.otherUsersRoute);
			const response = await finishRequestRoute(ids.otherUsersRoute, {
				body: { description: "Finalização" },
			});
			expect([403, 404]).toContain(response.statusCode);
			const after = await storedRoute(ids.otherUsersRoute);
			expect(after.status).toBe(ROUTE_STATUS.STARTED);
			expect(after.startedAt?.getTime()).toBe(before.startedAt?.getTime());
			expect(after.finishedAt).toBeNull();
			expect(after.description).toBeNull();
		});
	},
);
