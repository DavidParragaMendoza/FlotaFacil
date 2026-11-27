import {
	type GeneratedMarkdownReportResponseDTO,
	generatedMarkdownReportResponseSchema,
} from "@/contracts/reports/generate-fleet-report-schema";
import {
	type GeneratedRouteReportResponseDTO,
	generatedRouteReportResponseSchema,
} from "@/contracts/reports/generate-route-report-schema";
import { env } from "@/env";

type AiFleetReportPayload = {
	period?: {
		start?: string;
		end?: string;
	};
	users: {
		id: string;
		name?: string | null;
		department?: string | null;
		role?: string | null;
	}[];
	vehicles: {
		id: string;
		plate?: string | null;
		model?: string | null;
		year?: number | null;
		odometer?: number | null;
		status?: string | null;
		type?: string | null;
	}[];
	requests: {
		id: string;
		user_id?: string | null;
		vehicle_id?: string | null;
		approved_by?: string | null;
		status: string;
		predicted_start_date: string;
		predicted_end_date: string;
		reason?: string | null;
		created_at?: string | null;
		updated_at?: string | null;
	}[];
	routes: {
		id: string;
		request_id: string;
		status?: string | null;
		description?: string | null;
		started_at?: string | null;
		finished_at?: string | null;
		created_at?: string | null;
		updated_at?: string | null;
	}[];
	extra_context?: string;
	metadata: Record<string, unknown>;
};

type AiRouteReportPayload = {
	route: {
		id: string;
		request_id: string;
		status?: string | null;
		description?: string | null;
		started_at?: string | null;
		finished_at?: string | null;
		created_at?: string | null;
		updated_at?: string | null;
	};
	request?: {
		id: string;
		user_id?: string | null;
		vehicle_id?: string | null;
		approved_by?: string | null;
		status: string;
		predicted_start_date: string;
		predicted_end_date: string;
		reason?: string | null;
		created_at?: string | null;
		updated_at?: string | null;
	};
	vehicle?: {
		id: string;
		plate?: string | null;
		model?: string | null;
		year?: number | null;
		odometer?: number | null;
		status?: string | null;
		type?: string | null;
	};
	user?: {
		id: string;
		name?: string | null;
		department?: string | null;
		role?: string | null;
	};
	tracks: {
		id: string;
		route_id: string;
		latitude: number;
		longitude: number;
		captured_at: string;
		image_url: string | null;
		image_key: string | null;
		created_at: string;
		updated_at: string;
	}[];
	extra_context?: string;
	metadata: Record<string, unknown>;
};

type AiServiceHttpError = Error & { statusCode: number };

async function parseResponseBody(response: Response): Promise<unknown> {
	const rawText = await response.text();
	if (!rawText) {
		return null;
	}
	try {
		return JSON.parse(rawText);
	} catch {
		return rawText;
	}
}

function buildAiServiceError(
	status: number,
	responseBody: unknown,
): AiServiceHttpError {
	const error = new Error(
		`Erro ao chamar ai-report-service: ${JSON.stringify(responseBody)}`,
	) as AiServiceHttpError;
	error.statusCode = status >= 500 ? 502 : status;
	return error;
}

export async function requestFleetReportFromAiService(
	payload: AiFleetReportPayload,
): Promise<GeneratedMarkdownReportResponseDTO> {
	const response = await fetch(`${env.AI_REPORT_SERVICE_URL}/reports/fleet`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const responseBody = await parseResponseBody(response);

	if (!response.ok) {
		throw buildAiServiceError(response.status, responseBody);
	}

	return generatedMarkdownReportResponseSchema.parse(responseBody);
}

export async function requestRouteReportFromAiService(
	payload: AiRouteReportPayload,
): Promise<GeneratedRouteReportResponseDTO> {
	const response = await fetch(`${env.AI_REPORT_SERVICE_URL}/reports/routes`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const responseBody = await parseResponseBody(response);

	if (!response.ok) {
		throw buildAiServiceError(response.status, responseBody);
	}

	return generatedRouteReportResponseSchema.parse(responseBody);
}
