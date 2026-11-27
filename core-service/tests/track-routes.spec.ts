import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requests } from "@/domains/requests/schema";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { routes } from "@/domains/routes/schema";
import { ROUTE_STATUS } from "@/domains/routes/status";
import { tracks } from "@/domains/tracks/schema";
import { USER_ROLES } from "@/domains/users/roles";
import { users } from "@/domains/users/schema";
import { vehicles } from "@/domains/vehicles/schema";
import { VEHICLE_STATUS } from "@/domains/vehicles/status";

describe.skipIf(!process.env.TEST_DATABASE_URL)(
	"consultar tracks de uma rota",
	() => {
		const ids = {
			admin: randomUUID(),
			driver: randomUUID(),
			vehicle: randomUUID(),
			existingRoute: randomUUID(),
			emptyRoute: randomUUID(),
			otherRoute: randomUUID(),
			missingRoute: randomUUID(),
			firstTrack: randomUUID(),
			secondTrack: randomUUID(),
			otherTrack: randomUUID(),
		};
		const requestIds = [ids.existingRoute, ids.emptyRoute, ids.otherRoute];
		const routeIds = [ids.existingRoute, ids.emptyRoute, ids.otherRoute];
		const trackIds = [ids.firstTrack, ids.secondTrack, ids.otherTrack];
		const firstCapturedAt = new Date("2025-01-10T12:00:00.000Z");
		const secondCapturedAt = new Date("2025-01-10T12:05:00.000Z");
		let app: ReturnType<typeof fastify> | undefined;
		let db: typeof import("@/drizzle/client").db;
		let jwtPlugin: typeof import("@/plugins/jwt")["default"];
		let trackRouter: typeof import("@/routes/track-router")["trackRouter"];
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
			({ trackRouter } = await import("@/routes/track-router.js"));
			const schema = await db.execute(sql`
				SELECT
					to_regclass('public.users') AS users,
					to_regclass('public.vehicles') AS vehicles,
					to_regclass('public.requests') AS requests,
					to_regclass('public.routes') AS routes,
					to_regclass('public.tracks') AS tracks
			`);
			const schemaTables = schema.rows[0];
			const missingTables = [
				"users",
				"vehicles",
				"requests",
				"routes",
				"tracks",
			].filter((table) => !schemaTables?.[table]);
			if (missingTables.length > 0) {
				throw new Error(
					`O PostgreSQL de teste não tem as tabelas: ${missingTables.join(", ")}. ` +
						"Aplique as migrações com POSTGRES_DB apontando para o banco TEST_DATABASE_URL antes de executar esta spec.",
				);
			}
			schemaReady = true;

			await db.insert(users).values([
				{
					id: ids.admin,
					name: "Admin de teste",
					email: `${ids.admin}@example.test`,
					cpf: `1${ids.admin.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.admin.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999999",
					passwordHash: "test",
					role: USER_ROLES[1],
				},
				{
					id: ids.driver,
					name: "Motorista de teste",
					email: `${ids.driver}@example.test`,
					cpf: `1${ids.driver.replaceAll("-", "").slice(0, 10)}`,
					cnh: `2${ids.driver.replaceAll("-", "").slice(0, 10)}`,
					phone: "85999999998",
					passwordHash: "test",
					role: USER_ROLES[0],
				},
			]);
			await db.insert(vehicles).values({
				id: ids.vehicle,
				plate: `TST${ids.vehicle.replaceAll("-", "").slice(0, 4).toUpperCase()}`,
				model: "Veículo de teste",
				year: 2024,
				odometer: 100,
				status: VEHICLE_STATUS.AVAILABLE,
				type: "CAR",
			});
			const start = new Date("2025-01-10T10:00:00.000Z");
			const end = new Date("2025-01-10T18:00:00.000Z");
			await db.insert(requests).values(
				requestIds.map((id) => ({
					id,
					userId: ids.driver,
					vehicleId: ids.vehicle,
					status: REQUEST_STATUS.APPROVED,
					predictedStartDate: start,
					predictedEndDate: end,
					destination: "Campus",
					reason: "Teste de consulta de tracks",
				})),
			);
			await db.insert(routes).values(
				routeIds.map((id, index) => ({
					id,
					requestId: requestIds[index],
					status: ROUTE_STATUS.STARTED,
				})),
			);
			await db.insert(tracks).values([
				{
					id: ids.firstTrack,
					routeId: ids.existingRoute,
					latitude: -3.7319,
					longitude: -38.5267,
					capturedAt: firstCapturedAt,
				},
				{
					id: ids.secondTrack,
					routeId: ids.existingRoute,
					latitude: -3.7325,
					longitude: -38.5272,
					capturedAt: secondCapturedAt,
				},
				{
					id: ids.otherTrack,
					routeId: ids.otherRoute,
					latitude: 10.25,
					longitude: 20.5,
					capturedAt: new Date("2025-01-10T12:10:00.000Z"),
				},
			]);

			app = fastify();
			app.setValidatorCompiler(validatorCompiler);
			app.setSerializerCompiler(serializerCompiler);
			await app.register(jwtPlugin);
			await app.register(trackRouter);
			await app.listen({ host: "127.0.0.1", port: 0 });
		});

		afterEach(async () => {
			if (app) await app.close();
			app = undefined;
			if (!schemaReady) return;
			await db.delete(tracks).where(inArray(tracks.id, trackIds));
			await db.delete(routes).where(inArray(routes.id, routeIds));
			await db.delete(requests).where(inArray(requests.id, requestIds));
			await db.delete(vehicles).where(inArray(vehicles.id, [ids.vehicle]));
			await db.delete(users).where(inArray(users.id, [ids.admin, ids.driver]));
		});

		async function token(role: (typeof USER_ROLES)[number]) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			const id = role === USER_ROLES[1] ? ids.admin : ids.driver;
			return app.jwt.sign({ id, role });
		}

		async function getTracks(
			routeId: string,
			options: { auth?: boolean; role?: (typeof USER_ROLES)[number] } = {},
		) {
			if (!app) throw new Error("Aplicação de teste ainda não foi iniciada");
			const headers =
				options.auth === false
					? {}
					: {
							authorization: `Bearer ${await token(options.role ?? USER_ROLES[1])}`,
						};
			return app.inject({
				method: "GET",
				url: `/admin/tracks/${routeId}`,
				headers,
			});
		}

		it("retorna os tracks da rota com identificadores, coordenadas e timestamps", async () => {
			const response = await getTracks(ids.existingRoute);

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: ids.firstTrack,
						routeId: ids.existingRoute,
						latitude: -3.7319,
						longitude: -38.5267,
						capturedAt: firstCapturedAt.toISOString(),
					}),
					expect.objectContaining({
						id: ids.secondTrack,
						routeId: ids.existingRoute,
						latitude: -3.7325,
						longitude: -38.5272,
						capturedAt: secondCapturedAt.toISOString(),
					}),
				]),
			);
			expect(response.json()).toHaveLength(2);
		});

		it("retorna uma lista vazia para uma rota sem tracks", async () => {
			const response = await getTracks(ids.emptyRoute);

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual([]);
		});

		it("retorna 404 para uma rota inexistente sem dados de tracks", async () => {
			const response = await getTracks(ids.missingRoute);

			expect(response.statusCode).toBe(404);
			expect(response.json()).not.toHaveProperty("tracks");
		});

		it("nega a consulta sem autenticação", async () => {
			const response = await getTracks(ids.existingRoute, { auth: false });

			expect(response.statusCode).toBe(401);
			expect(response.json()).not.toHaveProperty("tracks");
		});

		it("nega a consulta autenticada como usuário comum", async () => {
			const response = await getTracks(ids.existingRoute, {
				role: USER_ROLES[0],
			});

			expect(response.statusCode).toBe(403);
			expect(response.json()).not.toHaveProperty("tracks");
		});

		it("rejeita routeId em formato inválido", async () => {
			const response = await getTracks("uuid-invalido");

			expect(response.statusCode).toBe(400);
			expect(response.json()).not.toHaveProperty("tracks");
		});
	},
);
