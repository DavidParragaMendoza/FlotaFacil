import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	findRouteByRequestId,
	findTripByIdAndUserId,
	startRouteForUserIfAvailable,
} from "@/domains/routes/db/repository";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { ROUTE_STATUS } from "@/domains/routes/status";
import { USER_ROLES } from "@/domains/users/roles";
import jwtPlugin from "@/plugins/jwt";
import { routeRouter } from "@/routes/route-router";
import { publishRouteStartedEvent } from "@/use-cases/route-event-service";
import { createAuditLog } from "@/use-cases/audit-log-service";
import { findUserById } from "@/domains/users/db/repository";
import { findById } from "@/domains/vehicles/db/repository";

vi.mock("@/domains/routes/db/repository", () => ({
	findRouteByRequestId: vi.fn(),
	findTripByIdAndUserId: vi.fn(),
	startRouteForUserIfAvailable: vi.fn(),
	findRoutes: vi.fn(),
	findRouteById: vi.fn(),
	findMyTrips: vi.fn(),
	findTripById: vi.fn(),
	updateRouteById: vi.fn(),
	updateRouteVehicleAndRequestStatusById: vi.fn(),
}));

vi.mock("@/domains/users/db/repository", () => ({ findUserById: vi.fn() }));
vi.mock("@/domains/vehicles/db/repository", () => ({ findById: vi.fn() }));
vi.mock("@/use-cases/route-event-service", () => ({
	publishRouteStartedEvent: vi.fn(),
	publishTrackCreatedEvent: vi.fn(),
}));
vi.mock("@/use-cases/audit-log-service", () => ({ createAuditLog: vi.fn() }));

const ids = {
	driver: "22222222-2222-4222-8222-222222222222",
	otherDriver: "77777777-7777-4777-8777-777777777777",
	request: "33333333-3333-4333-8333-333333333333",
	missingRequest: "44444444-4444-4444-8444-444444444444",
	route: "88888888-8888-4888-8888-888888888888",
	vehicle: "55555555-5555-4555-8555-555555555555",
};

const now = new Date("2026-11-23T10:00:00.000Z");

function makeTrip(overrides: Record<string, unknown> = {}) {
	return {
		id: ids.route,
		requestId: ids.request,
		routeStatus: ROUTE_STATUS.READY,
		requestStatus: REQUEST_STATUS.APPROVED,
		description: null,
		reportMarkdown: null,
		startedAt: null,
		finishedAt: null,
		predictedStartDate: new Date("2026-11-23T09:00:00.000Z"),
		predictedEndDate: new Date("2026-11-23T11:00:00.000Z"),
		destination: "Campus Benfica",
		reason: "Visita técnica",
		vehicle: {
			id: ids.vehicle,
			plate: "ABC1D23",
			model: "Fiat Toro",
			year: 2024,
			odometer: 1200,
			imageUrl: null,
			status: "AVAILABLE",
			type: "CAR",
		},
		...overrides,
	};
}

function makeRoute(overrides: Record<string, unknown> = {}) {
	return {
		id: ids.route,
		requestId: ids.request,
		status: ROUTE_STATUS.READY,
		description: null,
		reportMarkdown: null,
		startedAt: null,
		finishedAt: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("iniciar rota de solicitação aprovada", () => {
	let app: ReturnType<typeof fastify>;
	let routes: ReturnType<typeof makeRoute>[];
	let tripsByUser: Map<string, ReturnType<typeof makeTrip>>;

	beforeEach(async () => {
		vi.clearAllMocks();
		routes = [makeRoute()];
		tripsByUser = new Map([[ids.driver, makeTrip()]]);
		vi.mocked(findRouteByRequestId).mockImplementation(async (requestId) =>
			routes.find((route) => route.requestId === requestId),
		);
		vi.mocked(findTripByIdAndUserId).mockImplementation(async (_routeId, userId) =>
			tripsByUser.get(userId),
		);
		vi.mocked(startRouteForUserIfAvailable).mockImplementation(
			async ({ routeId, routeData }) => {
				const route = routes.find((item) => item.id === routeId);
				if (!route || route.status !== ROUTE_STATUS.READY) {
					return { status: "not_ready" };
				}
				const startedRoute = { ...route, ...routeData };
				routes = routes.map((item) => item.id === routeId ? startedRoute : item);
				return {
					status: "started",
					route: startedRoute,
					trip: makeTrip({ routeStatus: ROUTE_STATUS.STARTED, startedAt: routeData.startedAt }),
				};
			},
		);
		vi.mocked(findUserById).mockResolvedValue({ id: ids.driver, name: "Motorista" } as never);
		vi.mocked(findById).mockResolvedValue({ id: ids.vehicle, model: "Fiat Toro" } as never);
		vi.mocked(createAuditLog).mockResolvedValue(undefined);
		vi.mocked(publishRouteStartedEvent).mockResolvedValue(undefined);

		app = fastify();
		app.setValidatorCompiler(validatorCompiler);
		app.setSerializerCompiler(serializerCompiler);
		await app.register(jwtPlugin);
		await app.register(routeRouter);
		await app.ready();
	});

	afterEach(async () => app.close());

	async function userToken(userId = ids.driver) {
		return app.jwt.sign({ id: userId, role: USER_ROLES[0] });
	}

	async function start(requestId = ids.request, authenticated = true) {
		const token = authenticated ? await userToken() : undefined;
		return app.inject({
			method: "POST",
			url: `/routes/${requestId}`,
			headers: token ? { authorization: `Bearer ${token}` } : {},
		});
	}

	it("retorna 200, persiste a rota iniciada, mantém viagem disponível e publica evento", async () => {
		const response = await start();

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ routeStatus: ROUTE_STATUS.STARTED });
		expect(routes[0].status).toBe(ROUTE_STATUS.STARTED);
		expect(startRouteForUserIfAvailable).toHaveBeenCalledOnce();
		expect(publishRouteStartedEvent).toHaveBeenCalledWith(expect.objectContaining({
			type: "route.started",
			routeId: ids.route,
		}));
	});

	it("retorna 404 para solicitação inexistente sem iniciar rota nem publicar evento", async () => {
		const response = await start(ids.missingRequest);

		expect(response.statusCode).toBe(404);
		expect(routes[0].status).toBe(ROUTE_STATUS.READY);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
		expect(publishRouteStartedEvent).not.toHaveBeenCalled();
	});

	it("retorna 400 para solicitação pendente sem iniciar rota", async () => {
		tripsByUser.set(ids.driver, makeTrip({ requestStatus: REQUEST_STATUS.PENDING }));
		const response = await start();

		expect(response.statusCode).toBe(400);
		expect(routes[0].status).toBe(ROUTE_STATUS.READY);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
	});

	it("retorna 400 para solicitação rejeitada sem iniciar rota", async () => {
		tripsByUser.set(ids.driver, makeTrip({ requestStatus: REQUEST_STATUS.REJECTED }));
		const response = await start();

		expect(response.statusCode).toBe(400);
		expect(routes[0].status).toBe(ROUTE_STATUS.READY);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
	});

	it("retorna 400 para rota já iniciada sem criar outra rota ou publicar novo evento", async () => {
		routes = [makeRoute({ status: ROUTE_STATUS.STARTED, startedAt: now })];
		tripsByUser.set(ids.driver, makeTrip({ routeStatus: ROUTE_STATUS.STARTED, startedAt: now }));
		const response = await start();

		expect(response.statusCode).toBe(400);
		expect(routes).toHaveLength(1);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
		expect(publishRouteStartedEvent).not.toHaveBeenCalled();
	});

	it("retorna 401 sem JWT e não altera nada", async () => {
		const response = await start(ids.request, false);

		expect(response.statusCode).toBe(401);
		expect(routes[0].status).toBe(ROUTE_STATUS.READY);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
		expect(publishRouteStartedEvent).not.toHaveBeenCalled();
	});

	it("retorna 404 para solicitação de outro motorista sem persistir ou publicar evento", async () => {
		tripsByUser = new Map([[ids.otherDriver, makeTrip()]]);
		const response = await start();

		expect(response.statusCode).toBe(404);
		expect(routes[0].status).toBe(ROUTE_STATUS.READY);
		expect(startRouteForUserIfAvailable).not.toHaveBeenCalled();
		expect(publishRouteStartedEvent).not.toHaveBeenCalled();
	});
});
