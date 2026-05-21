import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.example.com';
const LOGIN_PATH = __ENV.LOGIN_PATH || '/api/auth/login';
const LOGOUT_PATH = __ENV.LOGOUT_PATH || '/api/auth/logout';
const USER = __ENV.USER || 'perfuser';
const PASS = __ENV.PASS || 'perfpass';

// end-to-end performance scenarios
export const options = {
  scenarios: {
    baseline_load: {
      executor: 'ramping-vus',
      startTime: '0s',
      stages: [
        { duration: '2m', target: 10 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 50 },
      ],
    },
    normal_load: {
      executor: 'ramping-vus',
      startTime: '6m',
      stages: [
        { duration: '2m', target: 100 },
        { duration: '6m', target: 200 },
        { duration: '2m', target: 200 },
      ],
    },
    stress_test: {
      executor: 'ramping-vus',
      startTime: '20m',
      stages: [
        { duration: '2m', target: 500 },
        { duration: '6m', target: 700 },
        { duration: '2m', target: 600 },
      ],
    },
    spike_test: {
      executor: 'ramping-vus',
      startTime: '40m',
      stages: [
        { duration: '30s', target: 1000 }, // sudden spike
        { duration: '4m', target: 1000 },
      ],
    },
  },
  thresholds: {
    // Baseline endpoints
    'http_req_duration{name="GET /api/resource"}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name="GET /api/resource/{id}"}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name="POST /api/resource"}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name="POST /api/db-heavy"}': ['p(95)<1000', 'p(99)<1500'],
    'http_req_failed': ['rate<0.01'],
  },
};

// Setup: obtain auth token (if API requires auth)
export function setup() {
  const loginUrl = BASE_URL + LOGIN_PATH;
  const payload = JSON.stringify({ username: USER, password: PASS });

  const res = http.post(loginUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  let token = '';
  if (res.status === 200) {
    try {
      const json = res.json();
      token = json?.token || json?.accessToken || '';
    } catch (e) {
      token = '';
    }
  }

  return { token };
}

// Teardown: attempt logout (best-effort)
export function teardown(data) {
  const token = data?.token;
  if (!BASE_URL || !LOGOUT_PATH) return;

  const url = BASE_URL + LOGOUT_PATH;
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    http.post(url, null, { headers });
  } catch (_) {
    // ignore teardown errors
  }
}

// Helper: pick endpoint with weights and dynamic IDs
function pickEndpoint() {
  // Weighted distribution: 50% basic list, 25% single item, 15% create, 10% heavy DB
  const r = Math.random();
  if (r < 0.50) {
    return {
      name: 'GET /api/resource',
      method: 'GET',
      path: '/api/resource',
      dynamic: false,
      body: null,
      contentType: null,
    };
  } else if (r < 0.75) {
    return {
      name: 'GET /api/resource/{id}',
      method: 'GET',
      path: '/api/resource/', // dynamic ID appended
      dynamic: true,
      body: null,
      contentType: null,
    };
  } else if (r < 0.90) {
    return {
      name: 'POST /api/resource',
      method: 'POST',
      path: '/api/resource',
      dynamic: false,
      body: JSON.stringify({ name: 'perf-test', timestamp: Date.now() }),
      contentType: 'application/json',
    };
  } else {
    return {
      name: 'POST /api/db-heavy',
      method: 'POST',
      path: '/api/db-heavy',
      dynamic: false,
      body: JSON.stringify({ batch: 1000 }),
      contentType: 'application/json',
    };
  }
}

export default function (data) {
  const token = data?.token;
  const headersBase = { 'Content-Type': 'application/json' };
  if (token) headersBase['Authorization'] = `Bearer ${token}`;

  const ep = pickEndpoint();

  let url = BASE_URL + ep.path;
  let body = ep.body;
  let method = ep.method;

  // If dynamic endpoint, append a random id
  if (ep.dynamic) {
    const id = Math.floor(Math.random() * 10000) + 1;
    url = BASE_URL + ep.path + id;
  }

  // Prepare request parameters with a named tag for thresholds
  const params = {
    headers: { ...headersBase },
    timeout: '30s',
    tags: { name: ep.name },
  };
  if (ep.contentType) {
    params.headers['Content-Type'] = ep.contentType;
  }

  const res = http.request(method, url, body, params);

  // Basic success check
  check(res, {
    [`${ep.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });

  sleep(0.2); // think time
}