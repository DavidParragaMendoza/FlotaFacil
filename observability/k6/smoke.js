import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
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
  // 1. Login administrativo (POST /admin/auth)
  const loginRes = http.post(
    `${CORE_URL}/admin/auth`,
    JSON.stringify({ cpf: ADMIN_CPF, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(loginRes, {
    'setup: login status 200': (r) => r.status === 200,
    'setup: login has jwt token': (r) => Boolean(r.json('token')),
  });

  const token = loginRes.json('token');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Asegurar al menos un vehículo disponible para las solicitudes
  const availRes = http.get(`${CORE_URL}/vehicles/available`, {
    headers: authHeaders,
  });

  let vehicles = [];
  try {
    vehicles = availRes.json() || [];
  } catch (_) {
    vehicles = [];
  }

  let vehicleId = vehicles.length > 0 ? vehicles[0].id : null;

  if (!vehicleId) {
    const uniquePlate = `K6S${Math.floor(1000 + Math.random() * 8999)}`;
    const createVehRes = http.post(
      `${CORE_URL}/admin/vehicles`,
      JSON.stringify({
        plate: uniquePlate,
        model: 'Fiat Cronos K6 Smoke',
        year: 2024,
        odometer: 1000,
        imageUrl: null,
        status: 'AVAILABLE',
        type: 'CAR',
      }),
      { headers: authHeaders }
    );
    if (createVehRes.status === 201) {
      vehicleId = createVehRes.json('id');
    }
  }

  // 3. Obtener o crear una ruta válida para el endpoint de tracking
  let routeId = '550e8400-e29b-41d4-a716-446655440000';
  const routesRes = http.get(`${CORE_URL}/admin/routes`, {
    headers: authHeaders,
  });
  if (routesRes.status === 200) {
    const routesList = routesRes.json();
    if (Array.isArray(routesList) && routesList.length > 0) {
      routeId = routesList[0].id;
    }
  }

  return {
    token,
    vehicleId,
    routeId,
    // Base temporal futura aleatoria para evitar colisiones de horario entre corridas
    baseStartMs:
      Date.now() +
      365 * 24 * 3600 * 1000 +
      Math.floor(Math.random() * 100000) * 3600 * 1000,
  };
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // 1. Consultar disponibilidad de vehículos (GET /vehicles/available)
  const availRes = http.get(`${CORE_URL}/vehicles/available`, {
    headers: authHeaders,
    tags: { endpoint: 'vehicles_available' },
  });
  check(availRes, {
    'GET /vehicles/available status 200': (r) => r.status === 200,
  });

  // 2. Crear solicitud de vehículo (POST /me/requests) con ventana única sin solapamiento
  if (data.vehicleId) {
    const slotOffsetMs = (__VU * 100000 + __ITER) * 120000;
    const startIso = new Date(data.baseStartMs + slotOffsetMs).toISOString();
    const endIso = new Date(
      data.baseStartMs + slotOffsetMs + 60000
    ).toISOString();

    const reqRes = http.post(
      `${CORE_URL}/me/requests`,
      JSON.stringify({
        vehicleId: data.vehicleId,
        predictedStartDate: startIso,
        predictedEndDate: endIso,
        destination: `Campus IFRN Natal - Iter ${__ITER}`,
        reason: `Smoke test k6 TC-OBS-002 (VU ${__VU}, iter ${__ITER})`,
      }),
      {
        headers: authHeaders,
        tags: { endpoint: 'create_request' },
      }
    );

    check(reqRes, {
      'POST /me/requests status 201': (r) => r.status === 201,
    });
  }

  // 3. Enviar coordenadas de tracking (POST :8080/routes/{routeId}/tracking)
  const trackRes = http.post(
    `${TRACKING_URL}/routes/${data.routeId}/tracking`,
    JSON.stringify({
      latitude: -5.812759 + (__ITER % 10) * 0.0001,
      longitude: -35.211 + (__ITER % 10) * 0.0001,
      capturedAt: new Date().toISOString(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'tracking_post' },
    }
  );

  check(trackRes, {
    'POST /routes/{routeId}/tracking status 200': (r) => r.status === 200,
  });

  sleep(1);
}
