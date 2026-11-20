import { fastify } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { approveRequestWithScheduleChecks } from "@/domains/requests/db/repository";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { USER_ROLES } from "@/domains/users/roles";
import jwtPlugin from "@/plugins/jwt";
import { requestRouter } from "@/routes/request-router";
import { createAuditLog } from "@/use-cases/audit-log-service";
import { notifyDriverAboutRequestApproved } from "@/use-cases/notification-service";
import { createRequestApprovedNotificationUseCase } from "@/use-cases/notifications/create-request-notification";
import { sendPushNotificationToUser } from "@/use-cases/push-notification-service";

vi.mock("@/domains/requests/db/repository", () => ({
	approveRequestWithScheduleChecks: vi.fn(),
}));

vi.mock("@/use-cases/audit-log-service", () => ({
	createAuditLog: vi.fn(),
}));

vi.mock("@/use-cases/notifications/create-request-notification", () => ({
	createRequestApprovedNotificationUseCase: vi.fn(),
}));

vi.mock("@/use-cases/notification-service", () => ({
	notifyDriverAboutRequestApproved: vi.fn(),
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

describe("aprovação de solicitação pelo administrador", () => {
	const requestStates = new Map<string, ReturnType<typeof makeRequest>>();
	let app: ReturnType<typeof fastify>;

	beforeEach(async () => {
		vi.clearAllMocks();
		requestStates.clear();
		requestStates.set(ids.request, makeRequest(REQUEST_STATUS.PENDING));

		vi.mocked(createAuditLog).mockResolvedValue(undefined);
		vi.mocked(createRequestApprovedNotificationUseCase).mockResolvedValue(
			undefined,
		);
		vi.mocked(notifyDriverAboutRequestApproved).mockResolvedValue(undefined);
		vi.mocked(sendPushNotificationToUser).mockResolvedValue(undefined);
		vi.mocked(approveRequestWithScheduleChecks).mockImplementation(
			async (requestId, approvedBy) => {
				const request = requestStates.get(requestId);

				if (!request) return { status: "not_found" };
				if (request.status !== REQUEST_STATUS.PENDING) {
					return { status: "not_pending" };
				}

				const approvedRequest = {
					...request,
					status: REQUEST_STATUS.APPROVED,
					approvedBy,
				};
				requestStates.set(requestId, approvedRequest);
				return { status: "approved", request: approvedRequest };
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

	function approvalUrl(requestId = ids.request) {
		return `/admin/requests/${requestId}/approve`;
	}

	it("retorna 200, altera para APPROVED e gera auditoria e evento", async () => {
		const response = await app.inject({
			method: "PUT",
			url: approvalUrl(),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[1])}` },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			id: ids.request,
			status: REQUEST_STATUS.APPROVED,
			approvedBy: ids.admin,
		});
		expect(requestStates.get(ids.request)?.status).toBe(
			REQUEST_STATUS.APPROVED,
		);
		expect(createAuditLog).toHaveBeenCalledWith({
			action: "REQUEST.APPROVED",
			entityId: ids.request,
			performedBy: ids.admin,
		});
		expect(createRequestApprovedNotificationUseCase).toHaveBeenCalledWith(
			ids.request,
		);
		expect(notifyDriverAboutRequestApproved).toHaveBeenCalledWith(ids.request);
	});

	it("retorna 404 para solicitação inexistente sem gerar aprovação", async () => {
		const response = await app.inject({
			method: "PUT",
			url: approvalUrl(ids.missingRequest),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[1])}` },
		});

		expect(response.statusCode).toBe(404);
		expect(createAuditLog).not.toHaveBeenCalled();
		expect(createRequestApprovedNotificationUseCase).not.toHaveBeenCalled();
		expect(notifyDriverAboutRequestApproved).not.toHaveBeenCalled();
	});

	it.each([
		["já aprovada", REQUEST_STATUS.APPROVED],
		["rejeitada", REQUEST_STATUS.REJECTED],
	])("retorna 400 ao tentar aprovar solicitação %s e não gera novo evento", async (_description, status) => {
		requestStates.set(ids.request, makeRequest(status));

		const response = await app.inject({
			method: "PUT",
			url: approvalUrl(),
			headers: {
				authorization: `Bearer ${await tokenFor(USER_ROLES[1])}`,
			},
		});

		expect(response.statusCode).toBe(400);
		expect(requestStates.get(ids.request)?.status).toBe(status);
		expect(createAuditLog).not.toHaveBeenCalled();
		expect(createRequestApprovedNotificationUseCase).not.toHaveBeenCalled();
		expect(notifyDriverAboutRequestApproved).not.toHaveBeenCalled();
	});

	it("retorna 401 sem JWT e não altera a solicitação", async () => {
		const response = await app.inject({ method: "PUT", url: approvalUrl() });

		expect(response.statusCode).toBe(401);
		expect(requestStates.get(ids.request)?.status).toBe(REQUEST_STATUS.PENDING);
		expect(approveRequestWithScheduleChecks).not.toHaveBeenCalled();
	});

	it("retorna 403 para motorista e não altera a solicitação", async () => {
		const response = await app.inject({
			method: "PUT",
			url: approvalUrl(),
			headers: { authorization: `Bearer ${await tokenFor(USER_ROLES[0])}` },
		});

		expect(response.statusCode).toBe(403);
		expect(requestStates.get(ids.request)?.status).toBe(REQUEST_STATUS.PENDING);
		expect(approveRequestWithScheduleChecks).not.toHaveBeenCalled();
	});
});
