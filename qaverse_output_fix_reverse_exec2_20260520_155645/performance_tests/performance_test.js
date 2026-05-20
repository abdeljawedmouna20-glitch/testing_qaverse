import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.API_BASE || 'https://api.example.com';
const TOKEN = __ENV.API_TOKEN || '';

const HEADERS = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN && TOKEN.trim() !== '') {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }
  return headers;
};

// Generic API endpoints with emphasis on a DB-heavy endpoint
const ENDPOINTS = [
  { name: 'Get Products', method: 'GET', url: '/api/v1/products', weight: 1 },
  { name: 'Get User Profile', method: 'GET', url: '/api/v1/users/me', weight: 1 },
  { name: 'Create Order', method: 'POST', url: '/api/v1/orders', weight: 1 },
  { name: 'Data Heavy Endpoint', method: 'GET', url: '/api/v1/data/heavy', weight: 3 },
  { name: 'Reports Summary', method: 'GET', url: '/api/v1/reports/summary', weight: 1 },
];

// Weighted random selection to bias towards heavy DB-related endpoints
function pickEndpoint() {
  const total = ENDPOINTS.reduce((acc, e) => acc + e.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    acc += ENDPOINTS[i].weight;
    if (r <= acc) return ENDPOINTS[i];
  }
  return ENDPOINTS[0];
}

export const options = {
  discardResponseBodies: true,
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '1m', target: 10 },
      ],
      exec: 'default',
    },
    normal: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 200 },
        { duration: '2m', target: 100 },
      ],
      exec: 'default',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 600 },
        { duration: '4m', target: 600 },
      ],
      exec: 'default',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Sudden spike to 1000 users
        { duration: '30s', target: 1000 },
        { duration: '5m', target: 1000 },
      ],
      exec: 'default',
    },
  },
  thresholds: {
    http_req_duration: ['p95<500', 'p99<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['count>0'],
  },
};

export function setup() {
  const healthUrl = `${BASE}/health`;
  try {
    const res = http.get(healthUrl, { headers: HEADERS() });
    return { healthStatus: res ? res.status : 0 };
  } catch (e) {
    return { healthStatus: 0 };
  }
}

export default function () {
  const ep = pickEndpoint();
  const url = `${BASE}${ep.url}`;
  const headers = HEADERS();

  let res;
  if (ep.method === 'GET') {
    res = http.get(url, { headers });
  } else if (ep.method === 'POST') {
    const payload = JSON.stringify({
      item_id: Math.floor(Math.random() * 100000),
      quantity: Math.ceil(Math.random() * 5),
    });
    res = http.post(url, payload, { headers });
  } else {
    res = http.get(url, { headers });
  }

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(Math.random() * 0.4 + 0.2);
}

export function teardown() {
  const teardownUrl = __ENV.TEARDOWN_URL;
  if (teardownUrl) {
    try {
      http.get(teardownUrl);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}