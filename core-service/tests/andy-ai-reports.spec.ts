import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ROLES } from "@/domains/users/roles";

// Evitar conexión real a RabbitMQ o Base de Datos al cargar app
vi.mock("@/plugins/rabbitmq", async () => {
	const fp = (await import("fastify-plugin")).default;
	return {
		default: fp(async () => {}),
	};
});

vi.mock("@/domains/routes/db/repository", () => ({
	findRouteById: vi.fn(),
	findRouteByRequestId: vi.fn(),
	findTripByIdAndUserId: vi.fn(),
	insertRoute: vi.fn(),
	startRouteForUserIfAvailable: vi.fn(),
	updateRouteById: vi.fn(),
	updateRouteVehicleAndRequestStatusById: vi.fn(),
}));

vi.mock("@/domains/reports/db/repository", () => ({
	fetchRouteReportData: vi.fn(),
}));

vi.mock("@/use-cases/audit-log-service", () => ({
	createAuditLog: vi.fn(),
}));

import { app } from "@/app";
import { fetchRouteReportData } from "@/domains/reports/db/repository";
import { REQUEST_STATUS } from "@/domains/requests/status";
import {
	findRouteById,
	findTripByIdAndUserId,
	updateRouteById,
	updateRouteVehicleAndRequestStatusById,
} from "@/domains/routes/db/repository";
import { ROUTE_STATUS } from "@/domains/routes/status";
import { VEHICLE_STATUS } from "@/domains/vehicles/status";
import { generateFleetReportUseCase } from "@/use-cases/reports/generate-fleet-report";
import { generateRouteReportUseCase } from "@/use-cases/reports/generate-route-report";
import { finishRouteUseCase } from "@/use-cases/routes/finish-route";

const VALID_ROUTE_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_ADMIN_UUID = "11111111-2222-4333-8444-555555555555";

describe("TC-AI-001 & TC-AI-002 — Reportes Analíticos con IA (core-service)", () => {
	let adminJwtToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		await app.ready();
		adminJwtToken = app.jwt.sign({
			id: VALID_ADMIN_UUID,
			role: USER_ROLES[1], // ADMIN
		});
	});

	describe("TC-AI-001: Generar reporte de flota con JWT admin, routeId UUID válido e IA simulada devolviendo markdown", () => {
		it("POST /admin/reports/fleet responde HTTP 200 con routeId coincidente y markdown_content no vacío", async () => {
			const simulatedMarkdown =
				"# Relatório Analítico da Rota\n\n- **Status:** Finalizada\n- **Desempenho:** Normal";

			vi.mocked(findRouteById).mockResolvedValueOnce({
				id: VALID_ROUTE_UUID,
				requestId: "660e8400-e29b-41d4-a716-446655440001",
				status: ROUTE_STATUS.FINISHED,
				description: "Entrega concluída sem ocorrências",
				reportMarkdown: simulatedMarkdown,
				startedAt: new Date("2026-11-24T10:00:00Z"),
				finishedAt: new Date("2026-11-24T11:30:00Z"),
				createdAt: new Date("2026-11-24T09:50:00Z"),
				updatedAt: new Date("2026-11-24T11:30:00Z"),
			});

			const response = await app.inject({
				method: "POST",
				url: "/admin/reports/fleet",
				headers: {
					authorization: `Bearer ${adminJwtToken}`,
				},
				payload: {
					routeId: VALID_ROUTE_UUID,
				},
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.routeId).toBe(VALID_ROUTE_UUID);
			expect(typeof body.markdown_content).toBe("string");
			expect(body.markdown_content.trim().length).toBeGreaterThan(0);
			expect(body.markdown_content).toBe(simulatedMarkdown);
			expect(findRouteById).toHaveBeenCalledTimes(1);
			expect(findRouteById).toHaveBeenCalledWith(VALID_ROUTE_UUID);
		});

		it("Flujo de integración con cliente IA simulado: genera markdown desde ai-service y persiste el informe en la ruta", async () => {
			const simulatedMarkdown =
				"# Relatório Gerado pela IA\n\nResumo completo da operação da rota.";

			const fetchSpy = vi
				.spyOn(globalThis, "fetch")
				.mockResolvedValueOnce(
					new Response(
						JSON.stringify({ markdown_content: simulatedMarkdown }),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					),
				);

			vi.mocked(fetchRouteReportData).mockResolvedValueOnce({
				route: {
					id: VALID_ROUTE_UUID,
					requestId: "660e8400-e29b-41d4-a716-446655440001",
					status: ROUTE_STATUS.FINISHED,
					description: "Rota concluída",
					reportMarkdown: null,
					startedAt: new Date("2026-11-24T10:00:00Z"),
					finishedAt: new Date("2026-11-24T11:00:00Z"),
					createdAt: new Date("2026-11-24T09:00:00Z"),
					updatedAt: new Date("2026-11-24T11:00:00Z"),
				},
				request: null,
				user: null,
				vehicle: null,
				tracks: [],
			});

			const markdown = await generateRouteReportUseCase(VALID_ROUTE_UUID);

			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(markdown).toBe(simulatedMarkdown);

			fetchSpy.mockRestore();
		});
	});

	describe("TC-AI-002 (a): routeId que no es UUID -> HTTP 400; la IA simulada NO es llamada", () => {
		it("POST /admin/reports/fleet con routeId inválido devuelve HTTP 400 y no invoca repositorio ni servicio de IA", async () => {
			const fetchSpy = vi.spyOn(globalThis, "fetch");

			const response = await app.inject({
				method: "POST",
				url: "/admin/reports/fleet",
				headers: {
					authorization: `Bearer ${adminJwtToken}`,
				},
				payload: {
					routeId: "no-es-un-uuid-valido",
				},
			});

			expect(response.statusCode).toBe(400);
			expect(findRouteById).not.toHaveBeenCalled();
			expect(fetchSpy).not.toHaveBeenCalled();

			fetchSpy.mockRestore();
		});
	});

	describe("TC-AI-002 (b): routeId válido con la IA simulada devolviendo 503 -> error controlado y ningún informe parcial guardado", () => {
		it("Cuando ai-service responde HTTP 503, generateRouteReportUseCase rechaza la operación y finishRouteUseCase NO guarda informe parcial", async () => {
			const fetchSpy = vi
				.spyOn(globalThis, "fetch")
				.mockImplementation(async () =>
					new Response(
						JSON.stringify({ detail: "AI upstream service unavailable (503)" }),
						{
							status: 503,
							headers: { "Content-Type": "application/json" },
						},
					),
				);

			vi.mocked(fetchRouteReportData).mockResolvedValue({
				route: {
					id: VALID_ROUTE_UUID,
					requestId: "660e8400-e29b-41d4-a716-446655440001",
					status: ROUTE_STATUS.FINISHED,
					description: "Rota concluída",
					reportMarkdown: null,
					startedAt: new Date("2026-11-24T10:00:00Z"),
					finishedAt: new Date("2026-11-24T11:00:00Z"),
					createdAt: new Date("2026-11-24T09:00:00Z"),
					updatedAt: new Date("2026-11-24T11:00:00Z"),
				},
				request: null,
				user: null,
				vehicle: null,
				tracks: [],
			});

			await expect(
				generateRouteReportUseCase(VALID_ROUTE_UUID),
			).rejects.toThrow(/Erro ao chamar ai-report-service/);

			// Verificar en finishRouteUseCase que ante el fallo 503 de la IA no se llama a updateRouteById con reportMarkdown parcial
			const driverId = "22222222-3333-4444-8555-666666666666";
			const vehicleId = "33333333-4444-4555-8666-777777777777";
			const requestId = "44444444-5555-4666-8777-888888888888";

			vi.mocked(findTripByIdAndUserId).mockResolvedValueOnce({
				id: VALID_ROUTE_UUID,
				routeId: VALID_ROUTE_UUID,
				requestId,
				routeStatus: ROUTE_STATUS.STARTED,
				requestStatus: REQUEST_STATUS.APPROVED,
				destination: "Campus IFRN Natal",
				reason: "Visita técnica",
				description: null,
				reportMarkdown: null,
				predictedStartDate: new Date("2026-11-24T10:00:00Z"),
				predictedEndDate: new Date("2026-11-24T12:00:00Z"),
				startedAt: new Date("2026-11-24T10:05:00Z"),
				finishedAt: null,
				vehicle: {
					id: vehicleId,
					plate: "ABC1D23",
					model: "Fiat Cronos",
					year: 2024,
					odometer: 15000,
					imageUrl: null,
					type: "CAR",
					status: VEHICLE_STATUS.IN_USE,
				},
			} as Awaited<ReturnType<typeof findTripByIdAndUserId>>);

			vi.mocked(updateRouteVehicleAndRequestStatusById).mockResolvedValueOnce({
				id: VALID_ROUTE_UUID,
				requestId,
				status: ROUTE_STATUS.FINISHED,
				description: "Finalizada",
				reportMarkdown: null,
				startedAt: new Date("2026-11-24T10:05:00Z"),
				finishedAt: new Date("2026-11-24T11:05:00Z"),
				createdAt: new Date("2026-11-24T09:00:00Z"),
				updatedAt: new Date("2026-11-24T11:05:00Z"),
			});

			await finishRouteUseCase(
				VALID_ROUTE_UUID,
				{ description: "Finalizada" },
				driverId,
			);

			// Dar margen al microtask asíncrono de generateAndSaveRouteReport
			await new Promise((resolve) => setTimeout(resolve, 25));

			expect(updateRouteById).not.toHaveBeenCalled();

			// Y al consultar POST /admin/reports/fleet para esa ruta sin reporte, no devuelve ningún informe parcial
			vi.mocked(findRouteById).mockResolvedValueOnce({
				id: VALID_ROUTE_UUID,
				requestId,
				status: ROUTE_STATUS.FINISHED,
				description: "Finalizada",
				reportMarkdown: null,
				startedAt: new Date("2026-11-24T10:05:00Z"),
				finishedAt: new Date("2026-11-24T11:05:00Z"),
				createdAt: new Date("2026-11-24T09:00:00Z"),
				updatedAt: new Date("2026-11-24T11:05:00Z"),
			});

			const fleetRes = await app.inject({
				method: "POST",
				url: "/admin/reports/fleet",
				headers: {
					authorization: `Bearer ${adminJwtToken}`,
				},
				payload: {
					routeId: VALID_ROUTE_UUID,
				},
			});

			expect(fleetRes.statusCode).toBe(404);
			expect(fleetRes.json()).toEqual({
				message: "Relatório da rota ainda não foi gerado",
			});

			fetchSpy.mockRestore();
		});
	});
});
