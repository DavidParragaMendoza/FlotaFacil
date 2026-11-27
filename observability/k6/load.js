import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },  // Calentamiento
    { duration: '20s', target: 10 }, // Carga sostenida
    { duration: '10s', target: 15 }, // Pico
    { duration: '5s', target: 0 },   // Enfriamiento
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const CORE_URL = __ENV.CORE_URL || 'http://localhost:3333';
const TRACKING_URL = __ENV.TRACKING_URL || 'http://localhost:8080';
const ADMIN_CPF = __ENV.ADMIN_CPF || '00000000000';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || '123456';

export function setup() {
  const loginRes = http.post(
    `${CORE_URL}/admin/auth`,
    JSON.stringify({ cpf: ADMIN_CPF, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'setup: login status 200': (r) => r.status === 200,
    'setup: login has token': (r) => Boolean(r.json('token')),
  });

  const token = loginRes.json('token');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let routeId = '550e8400-e29b-41d4-a716-446655440000';
  const routesRes = http.get(`${CORE_URL}/admin/routes`, {
    headers: authHeaders,
  });
  if (routesRes.status === 200) {
    const list = routesRes.json();
    if (Array.isArray(list) && list.length > 0) {
      routeId = list[0].id;
    }
  }

  return {
    token,
    routeId,
  };
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // 1. Consulta de vehículos disponibles (core-service + PostgreSQL pool)
  const availRes = http.get(`${CORE_URL}/vehicles/available`, {
    headers: authHeaders,
    tags: { endpoint: 'vehicles_available' },
  });
  check(availRes, {
    'GET /vehicles/available 200': (r) => r.status === 200,
  });

  // 2. Consulta de perfil autenticado y solicitudes propias (core-service JWT + PostgreSQL)
  const meReqRes = http.get(`${CORE_URL}/me/requests`, {
    headers: authHeaders,
    tags: { endpoint: 'me_requests' },
  });
  check(meReqRes, {
    'GET /me/requests 200': (r) => r.status === 200,
  });

  // 3. Envío de telemetría GPS (tracking-service -> RabbitMQ)
  const trackRes = http.post(
    `${TRACKING_URL}/routes/${data.routeId}/tracking`,
    JSON.stringify({
      latitude: -5.812759 + (__ITER % 20) * 0.0001,
      longitude: -35.211 + (__VU % 20) * 0.0001,
      capturedAt: new Date().toISOString(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'tracking_post' },
    }
  );
  check(trackRes, {
    'POST /routes/{routeId}/tracking 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
