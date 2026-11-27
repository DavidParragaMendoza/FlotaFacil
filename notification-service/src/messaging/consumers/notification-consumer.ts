import { ConsumeMessage } from "amqplib";
import { z } from "zod";
import { getChannel } from "../connection";
import { sendEmail } from "@/services/mailer";

const QUEUE = "notification.solicitation.created";

const eventSchema = z
	.object({
		recipients: z.array(z.string().trim().email()).min(1).optional(),
		to: z.string().trim().email().optional(),
		subject: z.string().trim().min(1).optional(),
		message: z.string().trim().min(1).optional(),
		payload: z
			.union([
				z.string(),
				z.object({ name: z.string().optional() }).passthrough(),
			])
			.optional(),
		data: z
			.object({
				requestId: z.string().trim().min(1).optional(),
				userName: z.string().optional(),
				vehicleName: z.string().optional(),
				vehiclePlate: z.string().optional(),
				reason: z.string().optional(),
				status: z.string().optional(),
				startsAt: z.string().optional(),
				endsAt: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough()
	.superRefine((event, context) => {
		if (event.recipients === undefined && event.to === undefined) {
			context.addIssue({
				code: "custom",
				path: ["recipients"],
				message: "Informe recipients ou o destinatário legado to",
			});
		}

		// Eventos publicados pelo core usam recipients e devem identificar a solicitação.
		// O formato legado to/payload permanece aceito sem data.requestId.
		if (event.recipients !== undefined && !event.data?.requestId) {
			context.addIssue({
				code: "custom",
				path: ["data", "requestId"],
				message: "data.requestId é obrigatório para eventos com recipients",
			});
		}
	});

type NotificationEvent = z.infer<typeof eventSchema>;

function buildEmailText(event: NotificationEvent): string {
	if (event.message !== undefined) {
		return event.message;
	}

	// Compatibilidade com notificações antigas que enviavam o corpo em payload.
	if (typeof event.payload === "string") {
		return event.payload;
	}

	// O core-service atual ainda não publica message. Mantemos o texto anterior
	// como fallback para não interromper as notificações existentes.
	const name = event.data?.userName ?? event.payload?.name ?? "";
	const vehicle = event.data?.vehicleName ?? "";
	const plate = event.data?.vehiclePlate ?? "";
	const reason = event.data?.reason ?? "";
	const startsAt = event.data?.startsAt
		? new Date(event.data.startsAt).toLocaleString("pt-BR")
		: "";
	const endsAt = event.data?.endsAt
		? new Date(event.data.endsAt).toLocaleString("pt-BR")
		: "";

	const details = `
        🚗 Veículo: ${vehicle}
        🔖 Placa: ${plate}
        📄 Motivo: ${reason}
        📅 Início: ${startsAt}
        📅 Fim: ${endsAt}
        `;

	if (event.data?.status === "approved") {
		return `Olá, ${name}!

        ✅ Sua solicitação foi APROVADA com sucesso.

        ${details}

        Boa viagem! 🚀`;
	}

	if (event.data?.status === "rejected") {
		return `Olá, ${name}!

        ❌ Sua solicitação foi RECUSADA.

        ${details}

        Caso tenha dúvidas, entre em contato com o administrador.`;
	}

	return `Olá, Administrador!

        📌 Pedido de solicitação criado.

        ${details}

        Agora você pode aprovar ou negar essa solicitação de veículo no seu dashboard!`;
}

export async function startNotificationConsumer() {
	const channel = getChannel();

	await channel.assertQueue(QUEUE, { durable: true });
	await channel.consume(QUEUE, async (msg: ConsumeMessage | null) => {
		if (!msg) return;

		try {
			const rawEvent: unknown = JSON.parse(msg.content.toString());
			const event = eventSchema.parse(rawEvent);
			const recipients = event.recipients ?? (event.to ? [event.to] : []);
			const subject = event.subject ?? "Atualização de solicitação";
			const text = buildEmailText(event);

			for (const recipient of recipients) {
				await sendEmail(recipient, subject, text);
			}

			channel.ack(msg);
		} catch (error) {
			console.error(error, "❌ Erro ao processar mensagem");

			// Payload inválido ou falha de envio: rejeita a mensagem para que o
			// broker a descarte ou a encaminhe à DLQ, se houver uma configurada.
			try {
				channel.nack(msg, false, false);
			} catch (nackError) {
				console.error(nackError, "❌ Erro ao rejeitar mensagem");
			}
		}
	});

	console.info(`👂 Consumindo fila: ${QUEUE}`);
}
