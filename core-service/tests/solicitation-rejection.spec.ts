import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	findRequestById,
	updateRequestById,
} from "@/domains/requests/db/repository";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { USER_ROLES } from "@/domains/users/roles";
import { VEHICLE_STATUS } from "@/domains/vehicles/status";
import jwtPlugin from "@/plugins/jwt";
import { requestRouter } from "@/routes/request-router";
import { createAuditLog } from "@/use-cases/audit-log-service";
import { notifyDriverAboutRequestRejected } from "@/use-cases/notification-service";
import { createRequestRejectedNotificationUseCase } from "@/use-cases/notifications/create-request-notification";
import { sendPushNotificationToUser } from "@/use-cases/push-notification-service";

vi.mock("@/domains/requests/db/repository", () => ({
	findRequestById: vi.fn(),
	updateRequestById: vi.fn(),
}));

vi.mock("@/use-cases/audit-log-service", () => ({
	createAuditLog: vi.fn(),
}));

vi.mock("@/use-cases/notifications/create-request-notification", () => ({
	createRequestRejectedNotificationUseCase: vi.fn(),
}));

vi.mock("@/use-cases/notification-service", () => ({
	notifyDriverAboutRequestRejected: vi.fn(),
}));

vi.mock("@/use-cases/push-notification-service", () => ({
	sendPushNotificationToUser: vi.fn(),
}));

const ids = {
	admin: "11111111-1111-4111-8111-111111111111",
	driver: "22222222-2222-4222-8222-222222222222",
	request: "33333333-3333-4333-8333-333333333333",
	missingRequest: "44444444-4444-4444-8444-444444444444",
	vehicle: "55555555-5555-4555-8555-555555555555",
};

const createdAt = new Date("2026-01-01T10:00:00.000Z");

function makeRequest(
	status: (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS],
) {
	return {
		id: ids.request,
		userId: ids.driver,
		vehicleId: ids.vehicle,
		approvedBy: status === REQUEST_STATUS.APPROVED ? ids.admin : null,
		status,
		predictedStartDate: new Date("2026-12-01T10:00:00.000Z"),
		predictedEndDate: new Date("2026-12-01T12:00:00.000Z"),
		destination: "Campus Benfica",
		reason: "Visita técnica",
		createdAt,
		updatedAt: createdAt,
	};
}

describe("rejeição de solicitação pelo administrador", () => {
	const requestStates = new Map<string, ReturnType<typeof makeRequest>>();
	const vehicleState = { status: VEHICLE_STATUS.AVAILABLE };
	const routeStates: unknown[] = [];
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.clearAllMocks();
		requestStates.clear();
		requestStates.set(ids.request, makeRequest(REQUEST_STATUS.PENDING));
		vehicleState.status = VEHICLE_STATUS.AVAILABLE;
		routeStates.length = 0;

		vi.mocked(createAuditLog).mockResolvedValue(undefined);
		vi.mocked(createRequestRejectedNotificationUseCase).mockResolvedValue(
			undefined as never,
		);
		vi.mocked(notifyDriverAboutRequestRejected).mockResolvedValue(undefined);
		vi.mocked(sendPushNotificationToUser).mockResolvedValue(undefined);
		vi.mocked(findRequestById).mockImplementation(async (requestId) =>
			requestStates.get(requestId),
		);
		vi.mocked(updateRequestById).mockImplementation(
			async (requestId, update) => {
				const request = requestStates.get(requestId);
				if (!request) return undefined;
				const updatedRequest = { ...request, ...update };
				requestStates.set(requestId, updatedRequest);
				return updatedRequest;
			},
		);

		app = fastify();
		app.setValidatorCompiler(validatorCompiler);
		app.setSerializerCompiler(serializerCompiler);
		await app.register(jwtPlugin);
		await app.register(requestRouter);
		await app.ready();
	});

	afterEach(async () => {
		await app.close();
	});

	async function tokenFor(role: (typeof USER_ROLES)[number]) {
		return app.jwt.sign({
			id: role === USER_ROLES[1] ? ids.admin : ids.driver,
			role,
		});
	}

	function rejectionUrl(requestId = ids.request) {
		return `/admin/requests/${requestId}/reject`;
	}

	it("retorna 200, rejeita a pendente, mantém veículo disponível e registra auditoria e evento", async () => {
		const response = await app.inject({
			method: "PUT",
			url: rejectionUrl(),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[1])}` },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			id: ids.request,
			status: REQUEST_STATUS.REJECTED,
		});
		expect(requestStates.get(ids.request)?.status).toBe(
			REQUEST_STATUS.REJECTED,
		);
		expect(vehicleState.status).toBe(VEHICLE_STATUS.AVAILABLE);
		expect(routeStates).toHaveLength(0);
		expect(updateRequestById).toHaveBeenCalledWith(ids.request, {
			status: REQUEST_STATUS.REJECTED,
		});
		expect(createAuditLog).toHaveBeenCalledWith({
			action: "REQUEST.REJECTED",
			entityId: ids.request,
			performedBy: ids.admin,
		});
		expect(createRequestRejectedNotificationUseCase).toHaveBeenCalledWith(
			ids.request,
		);
		expect(notifyDriverAboutRequestRejected).toHaveBeenCalledWith(ids.request);
		expect(sendPushNotificationToUser).toHaveBeenCalledWith({
			userId: ids.driver,
			title: "Solicitação recusada",
			body: "Sua solicitação de veículo foi recusada.",
			data: { requestId: ids.request, type: "REQUEST_REJECTED" },
		});
	});

	it("retorna 404 para solicitação inexistente sem realizar alterações", async () => {
		const response = await app.inject({
			method: "PUT",
			url: rejectionUrl(ids.missingRequest),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[1])}` },
		});

		expect(response.statusCode).toBe(404);
		expect(updateRequestById).not.toHaveBeenCalled();
		expect(createAuditLog).not.toHaveBeenCalled();
		expect(createRequestRejectedNotificationUseCase).not.toHaveBeenCalled();
		expect(notifyDriverAboutRequestRejected).not.toHaveBeenCalled();
		expect(sendPushNotificationToUser).not.toHaveBeenCalled();
	});

	it.each([
		["já rejeitada", REQUEST_STATUS.REJECTED],
		["aprovada", REQUEST_STATUS.APPROVED],
	])("retorna 400 ao tentar rejeitar solicitação %s sem nova operação", async (_description, status) => {
		requestStates.set(ids.request, makeRequest(status));

		const response = await app.inject({
			method: "PUT",
			url: rejectionUrl(),
			headers: {
				authorization: `Bearer ${await tokenFor(USER_ROLES[1])}`,
			},
		});

		expect(response.statusCode).toBe(400);
		expect(requestStates.get(ids.request)?.status).toBe(status);
		expect(updateRequestById).not.toHaveBeenCalled();
		expect(createAuditLog).not.toHaveBeenCalled();
		expect(createRequestRejectedNotificationUseCase).not.toHaveBeenCalled();
		expect(notifyDriverAboutRequestRejected).not.toHaveBeenCalled();
		expect(sendPushNotificationToUser).not.toHaveBeenCalled();
	});

	it("retorna 401 sem JWT e não altera a solicitação", async () => {
		const response = await app.inject({ method: "PUT", url: rejectionUrl() });

		expect(response.statusCode).toBe(401);
		expect(requestStates.get(ids.request)?.status).toBe(REQUEST_STATUS.PENDING);
		expect(findRequestById).not.toHaveBeenCalled();
		expect(updateRequestById).not.toHaveBeenCalled();
	});

	it("retorna 403 para motorista e não altera a solicitação", async () => {
		const response = await app.inject({
			method: "PUT",
			url: rejectionUrl(),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[0])}` },
		});

		expect(response.statusCode).toBe(403);
		expect(requestStates.get(ids.request)?.status).toBe(REQUEST_STATUS.PENDING);
		expect(findRequestById).not.toHaveBeenCalled();
		expect(updateRequestById).not.toHaveBeenCalled();
	});
});
