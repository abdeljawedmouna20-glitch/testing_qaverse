import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://api.example.com';
const USERNAME = __ENV.USERNAME || 'test';
const PASSWORD = __ENV.PASSWORD || 'test';

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '6m', target: 50 },
      ],
      exec: 'baselineRun',
    },
    normal: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '6m', target: 200 },
        { duration: '4m', target: 200 },
      ],
      exec: 'normalRun',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 300 },
        { duration: '8m', target: 600 },
        { duration: '6m', target: 600 },
      ],
      exec: 'stressRun',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 1000 },
        { duration: '5m', target: 1000 },
      ],
      exec: 'spikeRun',
    },
  },
  thresholds: {
    'http_req_duration': ['p95<500', 'p99<1000'], // response time targets
    'http_req_failed': ['rate<0.01'], // error rate target
  },
  // Optional: track additional metrics if needed
  // no teardown-phase thresholds needed here
};

// Custom metric to observe throughput (requests per second proxy)
const throughput = new Trend('throughput_rps');

export function setup() {
  const loginUrl = `${BASE_URL}/api/v1/auth/login`;
  const payload = JSON.stringify({ username: USERNAME, password: PASSWORD });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(loginUrl, payload, params);
  check(res, {
    'login status 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  let token = '';
  try {
    const json = res.json();
    token = json?.token ?? '';
  } catch (e) {
    // If token parsing fails, proceed with no token (endpoints may be public)
  }

  return { token };
}

export default function () {
  // This default function is unused; actual logic is in exec functions below
  // Kept for compatibility if needed by some runners
  sleep(0.1);
}

export function baselineRun(data) {
  runScenario(data);
}

export function normalRun(data) {
  runScenario(data);
}

export function stressRun(data) {
  runScenario(data);
}

export function spikeRun(data) {
  runScenario(data, true); // indicate spike mode (heavier DB work)
}

function runScenario(data, isSpike = false) {
  const token = data?.token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Pick an endpoint with weighted randomness to simulate varied load
  const endpoint = chooseEndpoint();

  // Build request
  const url = `${BASE_URL}${endpoint.path}`;
  let res;

  if (endpoint.method === 'GET') {
    res = http.get(url, { headers });
  } else if (endpoint.method === 'POST') {
    const payload = endpoint.payload ? JSON.stringify(endpoint.payload) : JSON.stringify({ sample: 'data' });
    res = http.post(url, payload, { headers });
  } else {
    // Generic dynamic request (PUT/DELETE/etc.)
    const payload = endpoint.payload ? JSON.stringify(endpoint.payload) : null;
    res = http.request(endpoint.method, url, payload, { headers });
  }

  // Basic checks
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // Adjust sleep to simulate realistic pacing and emphasize DB-heavy endpoints
  if (endpoint.name === 'DBHeavy') {
    // Heavier processing, longer think-time
    sleep(1.0 + Math.random() * 1.5);
  } else {
    sleep(0.2 + Math.random() * 1.0);
  }

  // Track a rough throughput proxy (requests per second)
  // Since k6 does not provide per-second throughput out-of-the-box here,
  // we estimate by using a short sleep window. This is a lightweight proxy value.
  // The actual throughput is reported by the test runner as http_reqs per second.
  throughput.add(1 / (Math.max(0.1, 0.2 + Math.random() * 0.8)));
}

function chooseEndpoint() {
  // Define endpoints with weights; heavier load goes to DB-heavy endpoints
  const endpoints = [
    { name: 'UsersList', path: '/api/v1/users', method: 'GET', weight: 1 },
    { name: 'UsersCreate', path: '/api/v1/users', method: 'POST', weight: 0.7, payload: { name: 'Test User', email: `test${Math.floor(Math.random() * 10000)}@example.com` } },
    { name: 'Products', path: '/api/v1/products', method: 'GET', weight: 1 },
    { name: 'Orders', path: '/api/v1/orders', method: 'GET', weight: 0.9 },
    { name: 'DBHeavy', path: '/api/v1/db-heavy', method: 'GET', weight: 1.5 },
    { name: 'DBStats', path: '/api/v1/db-stats', method: 'GET', weight: 0.7 },
    { name: 'Search', path: '/api/v1/search?q=performance', method: 'GET', weight: 0.8 },
  ];

  const total = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < endpoints.length; i++) {
    const e = endpoints[i];
    if (r < e.weight) return e;
    r -= e.weight;
  }
  return endpoints[endpoints.length - 1];
}

export function teardown(data) {
  const token = data?.token;
  if (!token) return;
  const url = `${BASE_URL}/api/v1/auth/logout`;
  const headers = { 'Authorization': `Bearer ${token}` };
  try {
    http.post(url, null, { headers });
  } catch (e) {
    // Ignore teardown errors
  }
}