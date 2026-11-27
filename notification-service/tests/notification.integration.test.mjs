import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, beforeEach, test } from "node:test";
import amqp from "amqplib";

const queue = "notification.solicitation.created";
const deadLetterExchange = "notification.integration.dead-letter";
const deadLetterQueue = "notification.solicitation.created.dlq";
const deadLetterPolicy = "notification-integration-dead-letter-policy";
const exchange = "app.events";
const routingKey = queue;
const mailhogUrl = process.env.TEST_MAILHOG_URL ?? "http://localhost:8025";
const managementUrl = process.env.TEST_RABBITMQ_MANAGEMENT_URL ?? "http://localhost:15672";
const brokerUrl = process.env.TEST_RABBITMQ_URL ??
	`amqp://${encodeURIComponent(process.env.RABBITMQ_USER ?? "admin")}:${encodeURIComponent(process.env.RABBITMQ_PASS ?? "admin")}@${process.env.TEST_RABBITMQ_HOST ?? "localhost"}:${process.env.RABBITMQ_AMQP_PORT ?? "5672"}`;
const parsedRabbitUrl = new URL(brokerUrl);
const testVhost = `notification-integration-${process.pid}-${Date.now()}`;
parsedRabbitUrl.pathname = `/${testVhost}`;
parsedRabbitUrl.search = "";
parsedRabbitUrl.hash = "";
const rabbitUrl = parsedRabbitUrl.toString();
const rabbitUser = decodeURIComponent(parsedRabbitUrl.username);
const rabbitPassword = decodeURIComponent(parsedRabbitUrl.password);
const requestId = () => `integration-${Date.now()}-${Math.random().toString(16).slice(2)}`;

let connection;
let channel;
let notification;
let notificationOutput = "";

function validEvent(overrides = {}) {
	const id = requestId();
	return {
		recipients: [`recipient-${id}@example.com`],
		subject: `Nova solicitação de veículo ${id}`,
		message: `Solicitação ${id}: Fiat Uno, placa ABC1234. Motivo: visita técnica.`,
		data: {
			requestId: id,
			userId: `user-${id}`,
			userName: "Carlos Motorista",
			userEmail: "carlos@example.com",
			vehicleId: `vehicle-${id}`,
			vehicleName: "Fiat Uno",
			vehiclePlate: "ABC1234",
			reason: "Visita técnica",
			status: "pending",
			startsAt: "2029-08-20T08:00:00.000Z",
			endsAt: "2029-08-20T10:00:00.000Z",
		},
		...overrides,
	};
}

async function mailhogMessages() {
	const response = await fetch(`${mailhogUrl}/api/v2/messages`);
	assert.equal(response.status, 200, `MailHog API respondeu HTTP ${response.status}`);
	return (await response.json()).items ?? [];
}

async function mailhogSnapshot() {
	return new Set((await mailhogMessages()).map((message) => message.ID));
}

async function newMailhogMessages(previousIds) {
	return (await mailhogMessages()).filter((message) => !previousIds.has(message.ID));
}

function messagesTo(messages, recipient) {
	return messages.filter((message) => JSON.stringify(message.Content.Headers.To).includes(recipient));
}

function decodeMimeHeader(header) {
	const unfolded = header.replace(/(\?=)\s+(?==\?)/g, "$1");
	return unfolded.replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi, (_word, charset, encoding, value) => {
		if (encoding.toLowerCase() === "b") {
			return Buffer.from(value, "base64").toString(charset);
		}

		const encoded = value.replace(/_/g, " ");
		const bytes = [];
		for (let index = 0; index < encoded.length; index += 1) {
			if (encoded[index] === "=" && /^[\da-f]{2}$/i.test(encoded.slice(index + 1, index + 3))) {
				bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
				index += 2;
			} else {
				bytes.push(encoded.charCodeAt(index));
			}
		}
		return Buffer.from(bytes).toString(charset);
	});
}

function decodeQuotedPrintable(value) {
	const unfolded = value.replace(/=\r?\n/g, "");
	const bytes = [];
	for (let index = 0; index < unfolded.length; index += 1) {
		if (unfolded[index] === "=" && /^[\da-f]{2}$/i.test(unfolded.slice(index + 1, index + 3))) {
			bytes.push(Number.parseInt(unfolded.slice(index + 1, index + 3), 16));
			index += 2;
		} else {
			bytes.push(unfolded.charCodeAt(index));
		}
	}
	return Buffer.from(bytes).toString("utf8");
}

function messagesWithSubject(messages, subject) {
	return messages.filter((message) =>
		(message.Content.Headers.Subject ?? []).some((value) => decodeMimeHeader(value) === subject),
	);
}

async function managementRequest(path, options = {}) {
	const credentials = Buffer.from(`${rabbitUser}:${rabbitPassword}`).toString("base64");
	return fetch(`${managementUrl}${path}`, {
		...options,
		headers: {
			authorization: `Basic ${credentials}`,
			...(options.body ? { "content-type": "application/json" } : {}),
			...options.headers,
		},
	});
}

async function createTestVhost() {
	const createResponse = await managementRequest(`/api/vhosts/${encodeURIComponent(testVhost)}`, {
		method: "PUT",
		body: JSON.stringify({}),
	});
	assert.ok(createResponse.ok, `Não foi possível criar vhost isolado no RabbitMQ (HTTP ${createResponse.status}); use credenciais com permissão de administração`);
	const permissionsResponse = await managementRequest(`/api/permissions/${encodeURIComponent(testVhost)}/${encodeURIComponent(rabbitUser)}`, {
		method: "PUT",
		body: JSON.stringify({ configure: ".*", write: ".*", read: ".*" }),
	});
	assert.ok(permissionsResponse.ok, `Não foi possível conceder permissões ao vhost de teste (HTTP ${permissionsResponse.status})`);
}

async function queueState(queueName = queue) {
	const response = await managementRequest(`/api/queues/${encodeURIComponent(testVhost)}/${encodeURIComponent(queueName)}`);
	assert.equal(response.status, 200, `RabbitMQ Management API respondeu HTTP ${response.status}`);
	return response.json();
}

async function outstandingMessages() {
	const state = await queueState();
	return (state.messages_ready ?? 0) + (state.messages_unacknowledged ?? 0);
}

async function queueMessageCount(queueName) {
	return (await channel.checkQueue(queueName)).messageCount;
}

async function waitFor(predicate, message, timeoutMs = 8000) {
	const until = Date.now() + timeoutMs;
	while (Date.now() < until) {
		const result = await predicate();
		if (result) return result;
		await delay(100);
	}
	assert.fail(message);
}

function startNotification(extraEnv = {}) {
	notificationOutput = "";
	const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)), "src/server.ts"], {
		cwd: fileURLToPath(new URL("..", import.meta.url)),
		env: {
			...process.env,
			PORT: "0",
			RABBITMQ_AMQP_HOST: parsedRabbitUrl.hostname,
			RABBITMQ_AMQP_PORT: parsedRabbitUrl.port || "5672",
			RABBITMQ_VHOST: testVhost,
			RABBITMQ_USER: rabbitUser,
			RABBITMQ_PASS: rabbitPassword,
			...extraEnv,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [child.stdout, child.stderr]) {
		stream.setEncoding("utf8");
		stream.on("data", (chunk) => { notificationOutput += chunk; });
	}
	return child;
}

async function waitUntilConsumerReady(child) {
	await waitFor(async () => {
		if (child.exitCode !== null) {
			assert.fail(`Notification encerrou ao iniciar. Saída: ${notificationOutput}`);
		}
		return notificationOutput.includes("Consumindo fila");
	}, "Notification não iniciou o consumidor da fila", 15000);
	await delay(100);
	assert.equal(child.exitCode, null, `Notification encerrou durante a inicialização. Saída: ${notificationOutput}`);
}

async function stopNotification() {
	if (!notification || notification.exitCode !== null) return;
	const child = notification;
	notification = undefined;
	child.kill("SIGTERM");
	await Promise.race([
		new Promise((resolve) => child.once("exit", resolve)),
		delay(5000).then(() => child.kill("SIGKILL")),
	]);
}

async function publish(event) {
	channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)), { persistent: true });
	await channel.waitForConfirms();
}

before(async () => {
	await createTestVhost();
	connection = await amqp.connect(rabbitUrl);
	channel = await connection.createConfirmChannel();
	await channel.assertExchange(exchange, "topic", { durable: true });
	// Let the real service declare its own queue before the test binds the event exchange.
	notification = startNotification();
	await waitUntilConsumerReady(notification);
	const declaredQueue = await queueState();
	assert.equal(declaredQueue.durable, true, "Notification deve declarar a fila como durável");
	await channel.bindQueue(queue, exchange, routingKey);
	await channel.assertExchange(deadLetterExchange, "direct", { durable: true });
	await channel.assertQueue(deadLetterQueue, { durable: true });
	await channel.bindQueue(deadLetterQueue, deadLetterExchange, deadLetterQueue);
	const policyResponse = await managementRequest(`/api/policies/${encodeURIComponent(testVhost)}/${encodeURIComponent(deadLetterPolicy)}`, {
		method: "PUT",
		body: JSON.stringify({
			pattern: `^${queue}$`,
			definition: {
				"dead-letter-exchange": deadLetterExchange,
				"dead-letter-routing-key": deadLetterQueue,
			},
			priority: 10,
			"apply-to": "queues",
		}),
	});
	assert.ok(policyResponse.ok, `Não foi possível configurar DLQ temporária (HTTP ${policyResponse.status})`);
	await channel.purgeQueue(queue);
	await channel.purgeQueue(deadLetterQueue);
	await stopNotification();
});

beforeEach(async () => {
	await stopNotification();
	await channel.purgeQueue(queue);
	await channel.purgeQueue(deadLetterQueue);
	notification = startNotification();
	await waitUntilConsumerReady(notification);
	await waitFor(async () => (await channel.checkQueue(queue)).consumerCount === 1, "O processo Notification iniciado pela suíte não se registrou como único consumidor");
});

after(async () => {
	await stopNotification();
	await channel?.close();
	await connection?.close();
	if (parsedRabbitUrl) {
		await managementRequest(`/api/vhosts/${encodeURIComponent(testVhost)}`, { method: "DELETE" });
	}
});

test("consome evento válido, confirma a mensagem e envia email ao destinatário", async () => {
	const event = validEvent();
	const existingMessages = await mailhogSnapshot();
	await publish(event);
	const messages = await waitFor(async () => {
		const received = messagesTo(await newMailhogMessages(existingMessages), event.recipients[0]);
		return received.length > 0 && received;
	}, "Nenhum email chegou ao MailHog após o evento válido");
	assert.match(JSON.stringify(messages[0].Content.Headers.To), new RegExp(event.recipients[0]));
	await waitFor(async () => (await outstandingMessages()) === 0, "Mensagem válida não saiu da fila após o processamento");
});

test("evento com endereço inválido não envia email e não é confirmado como sucesso", async () => {
	const event = validEvent({ recipients: ["endereco-invalido"] });
	await publish(event);
	await delay(800);
	assert.equal(messagesTo(await mailhogMessages(), event.recipients[0]).length, 0, "MailHog recebeu email para endereço inválido");
	await waitFor(async () => /Erro ao processar mensagem|email|recipient|destinat[aá]rio/i.test(notificationOutput), "Consumidor não registrou o erro do destinatário inválido");
	await waitFor(async () => (await queueMessageCount(deadLetterQueue)) === 1, "Evento com destinatário inválido não foi rejeitado para a DLQ definida no ambiente de teste");
});

test("evento sem destinatário obrigatório não é processado e segue para a DLQ", async () => {
	const withoutRecipients = validEvent({ recipients: [], data: { userName: "Carlos" } });
	await publish(withoutRecipients);
	await delay(800);
	assert.equal(messagesWithSubject(await mailhogMessages(), withoutRecipients.subject).length, 0, "MailHog recebeu email para evento sem destinatário");
	await waitFor(async () => notificationOutput.includes("Erro ao processar mensagem"), "Consumidor não registrou o evento incompleto como erro");
	await waitFor(async () => (await queueMessageCount(deadLetterQueue)) === 1, "Evento sem destinatário não foi rejeitado para a DLQ definida no ambiente de teste");
});

test("evento sem identificador da solicitação não é processado e segue para a DLQ", async () => {
	const withoutRequestId = validEvent({ data: { userName: "Carlos" } });
	await publish(withoutRequestId);
	await delay(800);
	assert.equal(messagesTo(await mailhogMessages(), withoutRequestId.recipients[0]).length, 0, "MailHog recebeu email para evento sem identificador da solicitação");
	await waitFor(async () => notificationOutput.includes("Erro ao processar mensagem"), "Consumidor não registrou a ausência do identificador como erro");
	await waitFor(async () => (await queueMessageCount(deadLetterQueue)) === 1, "Evento sem identificador não foi rejeitado para a DLQ definida no ambiente de teste");
});

test("JSON inválido não envia email e permanece tratado como mensagem inválida", async () => {
	const existingMessages = await mailhogSnapshot();
	channel.publish(exchange, routingKey, Buffer.from("{ JSON inválido"), { persistent: true });
	await channel.waitForConfirms();
	await delay(800);
	assert.equal((await newMailhogMessages(existingMessages)).length, 0, "MailHog recebeu email para mensagem JSON inválida");
	await waitFor(async () => notificationOutput.includes("Erro ao processar mensagem"), "Consumidor não registrou o JSON inválido como erro");
	await waitFor(async () => (await queueMessageCount(deadLetterQueue)) === 1, "JSON inválido não foi rejeitado para a DLQ definida no ambiente de teste");
});

test("evento duplicado com o mesmo identificador não duplica email quando idempotência estiver implementada", async (t) => {
	if (process.env.NOTIFICATION_IDEMPOTENCY_SUPPORTED !== "true") {
		t.skip("notification-service não declara suporte a idempotência; configure NOTIFICATION_IDEMPOTENCY_SUPPORTED=true para exigir a garantia");
		return;
	}
	const event = validEvent();
	const existingMessages = await mailhogSnapshot();
	await publish(event);
	await publish(event);
	await waitFor(async () => (await outstandingMessages()) === 0, "Eventos duplicados não terminaram de ser processados");
	await delay(300);
	assert.equal(messagesTo(await newMailhogMessages(existingMessages), event.recipients[0]).length, 1, "O mesmo requestId gerou mais de um email");
});

test("falha do serviço SMTP mantém a mensagem para retry ou rejeição", async () => {
	await stopNotification();
	notification = startNotification({ SMTP_HOST: "127.0.0.1", SMTP_PORT: "1" });
	await waitUntilConsumerReady(notification);
	const event = validEvent();
	await publish(event);
	await waitFor(async () => notificationOutput.includes("Erro ao processar mensagem"), "Falha SMTP não foi registrada pelo consumidor");
	assert.equal(messagesTo(await mailhogMessages(), event.recipients[0]).length, 0, "Email chegou ao MailHog durante indisponibilidade do SMTP configurado");
	await waitFor(async () => (await queueMessageCount(deadLetterQueue)) === 1, "Falha SMTP não foi rejeitada para a DLQ definida no ambiente de teste");
});

test("evento publicado sem consumidor ativo permanece na fila durável", async () => {
	await stopNotification();
	await waitFor(async () => (await channel.checkQueue(queue)).consumerCount === 0, "Ainda existe consumidor ativo na fila");
	const event = validEvent();
	await publish(event);
	await waitFor(async () => (await channel.checkQueue(queue)).messageCount === 1, "Evento não permaneceu disponível na fila durável sem consumidor");
	assert.equal((await channel.checkQueue(queue)).consumerCount, 0, "A fila deveria continuar sem consumidor durante a verificação de persistência");
});
