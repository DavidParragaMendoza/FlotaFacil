import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { after, before, beforeEach, test } from "node:test";
import amqp from "amqplib";
import pg from "pg";

// PostgreSQL stores captured_at as timestamp without time zone; make Date serialization stable.
process.env.TZ = "UTC";

const { Pool } = pg;
const exchange = "tracking";
const queue = "tracking.coordinates.updated";
const routingKey = "tracking.updated";
const managementUrl = process.env.TEST_RABBITMQ_MANAGEMENT_URL ?? "http://localhost:15672";
const corePort = process.env.TEST_CORE_PORT ?? "3333";
const coreUrl = process.env.TEST_CORE_URL ?? `http://127.0.0.1:${corePort}`;
const jwtSecret = process.env.JWT_SECRET ?? "tracking-integration-test-secret";
const databaseUrl = process.env.TEST_DATABASE_URL;
const brokerUrl = process.env.TEST_RABBITMQ_URL ??
	`amqp://${encodeURIComponent(process.env.RABBITMQ_DEFAULT_USER ?? "admin")}:${encodeURIComponent(process.env.RABBITMQ_DEFAULT_PASS ?? "admin")}@${process.env.TEST_RABBITMQ_HOST ?? "localhost"}:${process.env.RABBITMQ_AMQP_PORT ?? "5672"}`;
const parsedRabbitUrl = new URL(brokerUrl);
const testVhost = `tracking-integration-${process.pid}-${Date.now()}`;
parsedRabbitUrl.pathname = `/${testVhost}`;
parsedRabbitUrl.search = "";
parsedRabbitUrl.hash = "";
const rabbitUrl = parsedRabbitUrl.toString();
const rabbitUser = decodeURIComponent(parsedRabbitUrl.username);
const rabbitPassword = decodeURIComponent(parsedRabbitUrl.password);

let pool;
let connection;
let channel;
let core;
let coreOutput = "";
let fixture;

function event(overrides = {}) {
	return {
		eventId: randomUUID(),
		routeId: fixture.routeId,
		latitude: -3.7319,
		longitude: -38.5267,
		capturedAt: "2026-01-10T12:00:00.000Z",
		...overrides,
	};
}

function waitFor(predicate, message, timeoutMs = 12000) {
	const until = Date.now() + timeoutMs;
	return (async () => {
		while (Date.now() < until) {
			const value = await predicate();
			if (value) return value;
			await delay(100);
		}
		assert.fail(message);
	})();
}

async function managementRequest(path, options = {}) {
	const authorization = Buffer.from(`${rabbitUser}:${rabbitPassword}`).toString("base64");
	return fetch(`${managementUrl}${path}`, {
		...options,
		headers: {
			authorization: `Basic ${authorization}`,
			...(options.body ? { "content-type": "application/json" } : {}),
			...options.headers,
		},
	});
}

async function createVhost() {
	const created = await managementRequest(`/api/vhosts/${encodeURIComponent(testVhost)}`, {
		method: "PUT",
		body: JSON.stringify({}),
	});
	assert.ok(created.ok, `RabbitMQ não criou vhost de teste (HTTP ${created.status}); configure credenciais de administração`);
	const permissions = await managementRequest(`/api/permissions/${encodeURIComponent(testVhost)}/${encodeURIComponent(rabbitUser)}`, {
		method: "PUT",
		body: JSON.stringify({ configure: ".*", write: ".*", read: ".*" }),
	});
	assert.ok(permissions.ok, `RabbitMQ não concedeu permissões ao vhost de teste (HTTP ${permissions.status})`);
}

function startCore() {
	coreOutput = "";
	const database = new URL(databaseUrl);
	core = spawn(process.execPath, [
		fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),
		"src/server.ts",
	], {
		cwd: fileURLToPath(new URL("..", import.meta.url)),
		env: {
			...process.env,
			NODE_ENV: "test",
			PORT: corePort,
			POSTGRES_USER: decodeURIComponent(database.username),
			POSTGRES_PASSWORD: decodeURIComponent(database.password),
			POSTGRES_HOST: database.hostname,
			POSTGRES_PORT: database.port || "5432",
			POSTGRES_DB: decodeURIComponent(database.pathname.slice(1)),
			JWT_SECRET: jwtSecret,
			RABBITMQ_AMQP_HOST: parsedRabbitUrl.hostname,
			RABBITMQ_AMQP_PORT: parsedRabbitUrl.port || "5672",
			RABBITMQ_DEFAULT_USER: rabbitUser,
			RABBITMQ_DEFAULT_PASS: rabbitPassword,
			RABBITMQ_VHOST: testVhost,
			MINIO_ROOT_USER: process.env.MINIO_ROOT_USER ?? "minioadmin",
			MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
			MINIO_HOST: process.env.MINIO_HOST ?? "localhost",
			MINIO_ADMIN_HOST: process.env.MINIO_ADMIN_HOST ?? "localhost",
			MINIO_BUCKET: process.env.MINIO_BUCKET ?? "tracking-test",
			MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [core.stdout, core.stderr]) {
		stream.setEncoding("utf8");
		stream.on("data", (chunk) => { coreOutput += chunk; });
	}
}

async function waitForCore() {
	await waitFor(async () => {
		if (core?.exitCode !== null) assert.fail(`Core encerrou ao iniciar: ${coreOutput}`);
		return coreOutput.includes("RabbitMQ pronto");
	}, "Core não iniciou o consumidor RabbitMQ", 20000);
	await waitFor(async () => (await channel.checkQueue(queue)).consumerCount === 1,
		"Core não registrou o consumidor da fila");
}

async function stopCore() {
	if (!core || core.exitCode !== null) return;
	const child = core;
	core = undefined;
	child.kill("SIGTERM");
	await Promise.race([
		new Promise((resolve) => child.once("exit", resolve)),
		delay(5000).then(() => child.kill("SIGKILL")),
	]);
}

async function setupFixture() {
	const adminId = randomUUID();
	const driverId = randomUUID();
	const vehicleId = randomUUID();
	const requestId = randomUUID();
	const routeId = randomUUID();
	await pool.query(
		`INSERT INTO users (id, name, email, phone, cpf, password_hash, role)
		 VALUES ($1, 'Admin integração', $2, '85999990001', $3, 'test', 'admin'),
		        ($4, 'Motorista integração', $5, '85999990002', $6, 'test', 'driver')`,
		[adminId, `${adminId}@example.test`, `1${adminId.replaceAll("-", "").slice(0, 10)}`,
			driverId, `${driverId}@example.test`, `1${driverId.replaceAll("-", "").slice(0, 10)}`],
	);
	await pool.query(
		"INSERT INTO vehicles (id, plate, model, year, odometer, status, type) VALUES ($1, $2, 'Veículo integração', 2024, 0, 'AVAILABLE', 'CAR')",
		[vehicleId, `TST${vehicleId.replaceAll("-", "").slice(0, 7).toUpperCase()}`],
	);
	await pool.query(
		`INSERT INTO requests (id, user_id, vehicle_id, status, predicted_start_date, predicted_end_date, destination, reason)
		 VALUES ($1, $2, $3, 'APPROVED', '2026-01-10 10:00:00', '2026-01-10 18:00:00', 'Campus', 'Teste integração tracking')`,
		[requestId, driverId, vehicleId],
	);
	await pool.query("INSERT INTO routes (id, request_id, status) VALUES ($1, $2, 'STARTED')", [routeId, requestId]);
	return { adminId, driverId, vehicleId, requestId, routeId };
}

async function cleanupFixture(value) {
	if (!value) return;
	await pool.query("DELETE FROM routes WHERE id = $1", [value.routeId]);
	await pool.query("DELETE FROM requests WHERE id = $1", [value.requestId]);
	await pool.query("DELETE FROM vehicles WHERE id = $1", [value.vehicleId]);
	await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[value.adminId, value.driverId]]);
}

function adminJwt() {
	const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
	const payload = Buffer.from(JSON.stringify({ id: fixture.adminId, role: "admin" })).toString("base64url");
	const body = `${header}.${payload}`;
	return `${body}.${createHmac("sha256", jwtSecret).update(body).digest("base64url")}`;
}

async function publish(value) {
	channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(value)), { persistent: true });
	await channel.waitForConfirms();
}

async function outstandingMessages() {
	const response = await managementRequest(`/api/queues/${encodeURIComponent(testVhost)}/${encodeURIComponent(queue)}`);
	assert.equal(response.status, 200, `RabbitMQ Management API respondeu HTTP ${response.status}`);
	const state = await response.json();
	return (state.messages_ready ?? 0) + (state.messages_unacknowledged ?? 0);
}

async function tracks(routeId = fixture.routeId) {
	const response = await fetch(`${coreUrl}/admin/tracks/${routeId}`, {
		headers: { authorization: `Bearer ${adminJwt()}` },
	});
	assert.equal(response.status, 200, `GET tracks respondeu HTTP ${response.status}`);
	return response.json();
}

async function waitForTrackCount(expected, routeId = fixture.routeId) {
	await waitFor(async () => (await pool.query("SELECT count(*)::int AS count FROM tracks WHERE route_id = $1", [routeId])).rows[0].count === expected,
		`Esperava ${expected} tracks para a rota ${routeId}`);
}

before(async () => {
	assert.ok(databaseUrl, "Defina TEST_DATABASE_URL para um PostgreSQL de teste com as migrações aplicadas");
	const database = new URL(databaseUrl);
	assert.ok(["postgres:", "postgresql:"].includes(database.protocol), "TEST_DATABASE_URL deve usar PostgreSQL");
	assert.match(database.pathname, /(^|[_-])test([_-]|$)/i, "O nome do banco TEST_DATABASE_URL precisa conter 'test'");
	pool = new Pool({ connectionString: databaseUrl });
	await createVhost();
	connection = await amqp.connect(rabbitUrl);
	channel = await connection.createConfirmChannel();
	await channel.assertExchange(exchange, "topic", { durable: true });
	startCore();
	await waitForCore();
});

beforeEach(async () => {
	await channel.purgeQueue(queue);
	fixture = await setupFixture();
});

after(async () => {
	await stopCore();
	await cleanupFixture(fixture);
	await channel?.close();
	await connection?.close();
	await pool?.end();
	await managementRequest(`/api/vhosts/${encodeURIComponent(testVhost)}`, { method: "DELETE" });
});

test("consome e persiste tracking válido com confirmação da mensagem", async () => {
	const published = event();
	await publish(published);
	await waitForTrackCount(1);
	const stored = (await pool.query("SELECT route_id, latitude, longitude, captured_at FROM tracks WHERE route_id = $1", [fixture.routeId])).rows[0];
	assert.equal(stored.route_id, published.routeId);
	assert.equal(Number(stored.latitude), published.latitude);
	assert.equal(Number(stored.longitude), published.longitude);
	assert.equal(new Date(stored.captured_at).toISOString(), published.capturedAt);
	await waitFor(async () => (await outstandingMessages()) === 0,
		"Mensagem válida não foi consumida e confirmada");
});

test("consulta track persistido usando Admin JWT", async () => {
	const published = event();
	await publish(published);
	await waitForTrackCount(1);
	const result = await tracks();
	assert.ok(result.some((track) => track.routeId === published.routeId &&
		track.latitude === published.latitude && track.longitude === published.longitude &&
		track.capturedAt === published.capturedAt));
});

test("redelivery do mesmo evento não cria track duplicado", async () => {
	const published = event();
	await stopCore();
	await publish(published);
	const pending = await channel.get(queue, { noAck: false });
	assert.ok(pending, "Mensagem publicada não ficou disponível na fila");
	assert.equal(pending.fields.redelivered, false);
	channel.nack(pending, false, true);
	const redelivered = await channel.get(queue, { noAck: false });
	assert.ok(redelivered?.fields.redelivered, "RabbitMQ não marcou a mensagem como redelivered");
	channel.nack(redelivered, false, true);
	startCore();
	await waitForCore();
	await waitForTrackCount(1);
	// Reenvia o mesmo evento após o primeiro processamento para validar idempotência pelo eventId.
	await publish(published);
	await waitFor(async () => (await outstandingMessages()) === 0,
		"Redelivery/duplicata do evento não foi confirmada");
	await delay(250);
	assert.equal((await pool.query("SELECT count(*)::int AS count FROM tracks WHERE route_id = $1", [fixture.routeId])).rows[0].count, 1);
});

test("routeId inexistente não persiste track", async () => {
	const missingRouteId = randomUUID();
	await publish(event({ routeId: missingRouteId }));
	await waitFor(() => coreOutput.includes("Erro ao consumir tracking.coordinates.updated"),
		"Core não reportou a rejeição do evento com routeId inexistente");
	await stopCore();
	const redelivered = await waitFor(() => channel.get(queue, { noAck: false }),
		"Mensagem rejeitada não voltou à fila para redelivery");
	assert.ok(redelivered.fields.redelivered, "RabbitMQ não marcou a mensagem rejeitada para redelivery");
	channel.ack(redelivered);
	startCore();
	await waitForCore();
	assert.equal((await pool.query("SELECT count(*)::int AS count FROM tracks WHERE route_id = $1", [missingRouteId])).rows[0].count, 0);
});

test("coordenadas fora dos limites não são persistidas", async () => {
	await publish(event({ latitude: 91 }));
	await waitFor(async () => (await outstandingMessages()) === 0, "Evento com coordenadas inválidas não foi descartado/confirmado");
	assert.equal((await pool.query("SELECT count(*)::int AS count FROM tracks WHERE route_id = $1", [fixture.routeId])).rows[0].count, 0);
});

test("evento sem timestamp não é persistido como válido", async () => {
	const published = event();
	delete published.capturedAt;
	await publish(published);
	await waitFor(async () => (await outstandingMessages()) === 0, "Evento sem timestamp não foi tratado");
	assert.equal((await pool.query("SELECT count(*)::int AS count FROM tracks WHERE route_id = $1", [fixture.routeId])).rows[0].count, 0);
});

test("persiste eventos consecutivos sem sobrescrever tracks anteriores", async () => {
	const first = event({ capturedAt: "2026-01-10T12:00:00.000Z" });
	const second = event({ latitude: -3.75, longitude: -38.55, capturedAt: "2026-01-10T12:05:00.000Z" });
	await publish(first);
	await publish(second);
	await waitForTrackCount(2);
	const result = await tracks();
	assert.equal(result.length, 2);
	assert.ok(result.some((track) => track.latitude === first.latitude && track.longitude === first.longitude && track.capturedAt === first.capturedAt));
	assert.ok(result.some((track) => track.latitude === second.latitude && track.longitude === second.longitude && track.capturedAt === second.capturedAt));
});

test("consulta tracks isolados por rota", async () => {
	const first = event();
	await publish(first);
	await waitForTrackCount(1);
	const secondFixture = await setupFixture();
	try {
		const second = event({ routeId: secondFixture.routeId, latitude: 10.25, longitude: 20.5 });
		await publish(second);
		await waitForTrackCount(1, secondFixture.routeId);
		const firstResults = await tracks(fixture.routeId);
		const secondResults = await tracks(secondFixture.routeId);
		assert.ok(firstResults.length > 0 && firstResults.every((track) => track.routeId === fixture.routeId));
		assert.ok(secondResults.length > 0 && secondResults.every((track) => track.routeId === secondFixture.routeId));
	} finally {
		await cleanupFixture(secondFixture);
	}
});
