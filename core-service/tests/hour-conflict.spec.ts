import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertRequestWithScheduleChecks } from "@/domains/requests/db/repository";
import { REQUEST_STATUS } from "@/domains/requests/status";
import { findUserById } from "@/domains/users/db/repository";
import type { User } from "@/domains/users/schema";
import type { Vehicle } from "@/domains/vehicles/db/repository";
import { findById } from "@/domains/vehicles/db/repository";
import { VEHICLE_STATUS } from "@/domains/vehicles/status";
import { createAuditLog } from "@/use-cases/audit-log-service";
import { notifyAdminsAboutNewRequest } from "@/use-cases/notification-service";
import { createMyRequestUseCase } from "@/use-cases/requests/create-my-request";

vi.mock("@/domains/users/db/repository", () => ({
	findUserById: vi.fn(),
}));

vi.mock("@/domains/vehicles/db/repository", () => ({
	findById: vi.fn(),
}));

vi.mock("@/domains/requests/db/repository", () => ({
	insertRequestWithScheduleChecks: vi.fn(),
}));

vi.mock("@/use-cases/audit-log-service", () => ({
	createAuditLog: vi.fn(),
}));

vi.mock("@/use-cases/notification-service", () => ({
	notifyAdminsAboutNewRequest: vi.fn(),
}));

const ids = {
	requester: "11111111-1111-4111-8111-111111111111",
	approvedRequest: "22222222-2222-4222-8222-222222222222",
	vehicle: "33333333-3333-4333-8333-333333333333",
	otherVehicle: "44444444-4444-4444-8444-444444444444",
};

const existingPeriod = {
	start: new Date("2026-11-20T10:00:00.000Z"), // Período de início da viagem já marcada
	end: new Date("2026-11-20T12:00:00.000Z"), // Período de término da viagem já marcada
};

const requester = {
	id: ids.requester,
	name: "Motorista de teste",
	email: "motorista@example.com",
	cpf: "12345678901",
	cnh: "12345678900",
	phone: "85999999999",
	photoUrl: null,
	department: "Operações",
	role: "driver",
	passwordHash: "hash",
	createdAt: new Date("2026-01-01T10:00:00.000Z"),
	updatedAt: new Date("2026-01-01T10:00:00.000Z"),
} satisfies User;

function makeVehicle(id: string): Vehicle {
	return {
		id,
		plate: id === ids.vehicle ? "ABC1D23" : "XYZ9A87",
		model: "Fiat Toro",
		year: 2024,
		odometer: 1200,
		imageUrl: null,
		status: VEHICLE_STATUS.AVAILABLE,
		type: "CAR",
		createdAt: new Date("2026-01-01T10:00:00.000Z"),
		updatedAt: new Date("2026-01-01T10:00:00.000Z"),
	};
}

function overlaps(start: Date, end: Date) {
	return start < existingPeriod.end && end > existingPeriod.start;
}

describe("conflito de horário da solicitação de viagem", () => {
	beforeEach(() => {
		vi.mocked(findUserById).mockResolvedValue(requester);
		vi.mocked(findById).mockImplementation(async (vehicleId) =>
			makeVehicle(vehicleId),
		);
		vi.mocked(createAuditLog).mockResolvedValue(undefined);
		vi.mocked(notifyAdminsAboutNewRequest).mockResolvedValue(undefined);

		vi.mocked(insertRequestWithScheduleChecks).mockImplementation(
			async (data) => {
				if (
					data.vehicleId === ids.vehicle &&
					overlaps(data.predictedStartDate, data.predictedEndDate)
				) {
					return { conflict: "vehicle" };
				}

				return {
					request: {
						id: ids.approvedRequest,
						userId: data.userId,
						vehicleId: data.vehicleId,
						approvedBy: null,
						status: REQUEST_STATUS.PENDING,
						predictedStartDate: data.predictedStartDate,
						predictedEndDate: data.predictedEndDate,
						destination: data.destination,
						reason: data.reason,
						createdAt: new Date("2026-11-19T10:00:00.000Z"),
						updatedAt: new Date("2026-11-19T10:00:00.000Z"),
					},
				};
			},
		);
	});

	const request = (start: string, end: string, vehicleId = ids.vehicle) => ({
		vehicleId,
		predictedStartDate: new Date(`2026-11-20T${start}:00.000Z`),
		predictedEndDate: new Date(`2026-11-20T${end}:00.000Z`),
		destination: "Campus Benfica",
		reason: "Visita técnica",
	});

	it.each([
		["período exatamente igual ao de outra aprovada", "10:00", "12:00"],
		["período parcialmente sobreposto pelo início", "09:00", "11:00"],
		["período parcialmente sobreposto pelo final", "11:00", "13:00"],
		["período que engloba completamente o existente", "09:00", "13:00"],
	])("rejeita solicitação com %s e não cria outra", async (_description, start, end) => {
		await expect(
			createMyRequestUseCase(ids.requester, request(start, end)),
		).rejects.toMatchObject({ statusCode: 400 });

		expect(insertRequestWithScheduleChecks).toHaveBeenCalledTimes(1);
		expect(createAuditLog).not.toHaveBeenCalled();
		expect(notifyAdminsAboutNewRequest).not.toHaveBeenCalled();
	});

	it("cria solicitação com período sem sobreposição", async () => {
		const result = await createMyRequestUseCase(
			ids.requester,
			request("13:00", "15:00"),
		);

		expect(result.vehicleId).toBe(ids.vehicle);
		expect(result.predictedStartDate).toEqual(
			new Date("2026-11-20T13:00:00.000Z"),
		);
		expect(result.predictedEndDate).toEqual(
			new Date("2026-11-20T15:00:00.000Z"),
		);
		expect(createAuditLog).toHaveBeenCalledOnce();
		expect(notifyAdminsAboutNewRequest).toHaveBeenCalledOnce();
	});

	it("cria solicitação conflitante no horário quando usa outro veículo", async () => {
		const result = await createMyRequestUseCase(
			ids.requester,
			request("10:00", "12:00", ids.otherVehicle),
		);

		expect(result.vehicleId).toBe(ids.otherVehicle);
		expect(result.predictedStartDate).toEqual(
			new Date("2026-11-20T10:00:00.000Z"),
		);
		expect(result.predictedEndDate).toEqual(
			new Date("2026-11-20T12:00:00.000Z"),
		);
		expect(createAuditLog).toHaveBeenCalledOnce();
		expect(notifyAdminsAboutNewRequest).toHaveBeenCalledOnce();
	});
});
