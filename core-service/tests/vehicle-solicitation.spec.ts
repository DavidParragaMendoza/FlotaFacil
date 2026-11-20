import { describe, expect, it } from "vitest";
import { createMyRequestUseCase } from "@/use-cases/requests/create-my-request";

describe("solicitacao de viagem: periodo", () => {
	const startDate = new Date("2026-11-20T10:00:00");

	it.each([
		["igual ao inicio", new Date("2026-11-20T10:00:00")],
		["anterior ao inicio", new Date("2026-11-20T09:00:00")],
	])("retorna HTTP 400 quando a data final e %s", async (_description, endDate) => {
		await expect(
			createMyRequestUseCase("user-id", {
				vehicleId: "vehicle-id",
				predictedStartDate: startDate,
				predictedEndDate: endDate,
				destination: "Campus Benfica",
				reason: "Visita tecnica",
			}),
		).rejects.toMatchObject({ statusCode: 400 });
	});
});
