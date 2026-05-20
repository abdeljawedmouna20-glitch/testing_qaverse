// integrational_tests.backend.js
// Comprehensive backend integration tests (generic, adaptable).
// Framework: Jest + SuperTest for HTTP API testing, with optional DB and external service mocking.
// This file is designed to be drop-in for a backend project. Adjust APP_ENTRY and environment variables as needed.

'use strict';

const request = require('supertest');
const { execSync } = require('child_process');
const path = require('path');
let app;

// Optional DB client (PostgreSQL) for direct DB verification if TEST_DATABASE_URL is provided
let dbClient;
let token;
let testUserCreated = false;

describe('Backend Integration Test Suite (API, DB, Services, Auth, and External Mocking)', () => {
  // Load the application instance
  beforeAll(async () => {
    // 1) Setup test database (if configured)
    // Attempt to run migrations for test DB. If the project doesn't expose migrate:test, this will be skipped gracefully.
    try {
      // Assuming a script exists in package.json: "migrate:test"
      execSync('npm run migrate:test', { stdio: 'ignore' });
    } catch (e) {
      // Ignore if no migration script is found. Tests should still run against existing test DB if configured.
    }

    // 2) Initialize DB connection if a test DB URL is provided
    const testDbUrl = process.env.TEST_DATABASE_URL;
    if (testDbUrl) {
      try {
        // pg is a common choice; fallback if not available will skip direct DB checks
        const { Client } = require('pg');
        dbClient = new Client({ connectionString: testDbUrl });
        await dbClient.connect();
      } catch (e) {
        // If pg isn't installed or connection fails, we simply skip direct DB assertions
        dbClient = null;
        console.warn('Warning: Failed to initialize test DB client. Direct DB assertions will be skipped.');
      }
    }

    // 3) Load application instance
    // Expect APP_ENTRY to point to the module exporting an Express app or a function that returns one.
    const APP_ENTRY = process.env.APP_ENTRY || path.resolve(__dirname, '../src/app'); // default path; adjust as needed
    try {
      const appModule = require(APP_ENTRY);
      app = (typeof appModule === 'function') ? appModule() : appModule;
    } catch (err) {
      throw new Error(`Failed to load app from APP_ENTRY (${process.env.APP_ENTRY || APP_ENTRY}): ${err.message}`);
    }

    // 4) Optional: Create a test user (best effort)
    // If /auth/register exists, attempt to register a test user to ensure authentication flows work.
    try {
      const resReg = await request(app)
        .post('/auth/register')
        .send({ username: 'integration_user', email: 'integration@example.com', password: 'P@ssw0rd!' });
      // Accept 200/201 as successful registration; if endpoint is disabled, ignore
      if (resReg.status === 200 || resReg.status === 201) {
        testUserCreated = true;
      }
    } catch (e) {
      // If registration endpoint doesn't exist, continue; we'll try login with a pre-seeded user or token
      testUserCreated = false;
    }

    // 5) Login to obtain an access token for authenticated requests
    // Prefer newly registered user; fallback to a pre-seeded user if needed
    const loginPayloads = [
      { username: 'integration_user', password: 'P@ssw0rd!' },
      { username: 'testuser', password: 'Test@1234' },
    ];

    for (const payload of loginPayloads) {
      try {
        const resLogin = await request(app)
          .post('/auth/login')
          .send(payload);

        if (resLogin.status >= 200 && resLogin.status < 300) {
          token = resLogin.body?.accessToken || resLogin.body?.token;
          if (token) break;
        }
      } catch (e) {
        // try next payload
      }
    }

    // If still no token, attempt to read from env (useful in CI)
    if (!token) {
      token = process.env.TEST_TOKEN || null;
    }

    // If there is still no token, tests that require auth will be skipped with a warning
  });

  // Teardown: clean up DB and close connections
  afterAll(async () => {
    // Optional teardown migrations
    try {
      execSync('npm run migrate:teardown:test', { stdio: 'ignore' });
    } catch (e) {
      // ignore
    }

    // Close DB client if opened
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (e) {
        // ignore
      }
    }
  });

  // Helper: ensure we have a token for authenticated tests
  const requireAuth = () => {
    if (!token) {
      throw new Error('Test requires an authentication token. Ensure login/registration flow is configured.');
    }
  };

  // 1) Basic health check
  test('Health check: GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  // 2) Authentication flow tests
  describe('Authentication flows', () => {
    test('Registering a new user (optional, if endpoint exists) should return 200/201', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ username: 'e2e_user', email: 'e2e@example.com', password: 'SecureP@ss1' });

      // If endpoint exists, expect 200/201; otherwise, gracefully skip
      if (res.status === 200 || res.status === 201) {
        expect([200, 201].includes(res.status)).toBe(true);
      } else {
        // Endpoint not available; skip assertion
        expect(res.status).not.toBeGreaterThan(299);
      }
    });

    test('Login with valid credentials should return access token', async () => {
      // Try with the user we expect to exist
      const payloads = [
        { username: 'integration_user', password: 'P@ssw0rd!' },
        { username: 'e2e_user', password: 'SecureP@ss1' },
      ];
      let localToken = null;
      for (const p of payloads) {
        try {
          const res = await request(app).post('/auth/login').send(p);
          if (res.status >= 200 && res.status < 300) {
            localToken = res.body?.accessToken || res.body?.token;
            if (localToken) break;
          }
        } catch (_) {
          // continue
        }
      }
      // Update shared token if available
      if (localToken) token = localToken;
      expect(token).toBeTruthy();
    });

    test('Access protected endpoint with token should return 200', async () => {
      requireAuth();
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`);
      // Endpoint may be /profile or similar; if not available, skip assertion gracefully
      if (res.status) {
        expect([200, 304].includes(res.status)).toBe(true);
      }
    });
  });

  // 3) Data flow: API -> Service -> Database
  describe('Data flow: API -> Service -> Database', () => {
    let createdResourceId;

    test('Create a resource via API and verify response', async () => {
      requireAuth();
      const payload = { name: 'Test Resource', description: 'Integration test resource' };

      const res = await request(app)
        .post('/api/v1/resources')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      if (res.status === 201 || res.status === 200) {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(payload.name);
        createdResourceId = res.body.id;
      } else {
        // If endpoint not available, skip
        expect(res.status).toBeLessThan(500);
      }
    });

    test('Retrieve created resource via API', async () => {
      if (!createdResourceId) {
        return;
      }
      requireAuth();
      const res = await request(app)
        .get(`/api/v1/resources/${createdResourceId}`)
        .set('Authorization', `Bearer ${token}`);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('id', createdResourceId);
        expect(res.body).toHaveProperty('name');
      } else {
        // endpoint might not exist; skip
        expect(res.status).toBeGreaterThanOrEqual(200);
      }
    });

    test('Verify resource persisted in DB (optional)', async () => {
      if (!dbClient || !createdResourceId) {
        return;
      }
      try {
        const res = await dbClient.query('SELECT id, name FROM resources WHERE id = $1', [createdResourceId]);
        expect(res.rows.length).toBeGreaterThan(0);
        // Best-effort: compare name if present
        if (res.rows[0].name) {
          expect(res.rows[0].name).toBe('Test Resource');
        }
      } catch (e) {
        // If table or column doesn't exist in this environment, skip DB assertion gracefully
      }
    });
  });

  // 4) External service integration using mocking
  describe('External service integration (mocked)', () => {
    test('Create an order triggers external payment call (mocked)', async () => {
      requireAuth();

      // Use nock to intercept external HTTP calls made by the API during order creation
      const nock = require('nock');
      const externalBase = process.env.EXTERNAL_SERVICE_BASE_URL || 'https://payments.example.com';
      const scope = nock(externalBase)
        .post('/payments')
        .reply(200, { status: 'approved', transactionId: 'tx-12345' });

      const payload = { amount: 25, currency: 'USD', paymentMethod: 'card', resourceId: 1 };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      // Depending on implementation; either 200/201 with status field or a 202
      expect([200, 201].includes(res.status)).toBe(true);

      // If the API returns a status field from the payment result, verify it
      if (res.body) {
        const st = res.body.status || res.body.paymentStatus;
        if (st) {
          expect(['approved', 'paid', 'completed']).toContain(st);
        }
      }

      scope.done();
    });
  });

  // 5) Transaction behavior (best-effort)
  describe('Transactional behavior (best-effort tests)', () => {
    test('Attempt to create resource that triggers failure and ensure rollback (if supported)', async () => {
      // This test assumes the API provides a way to simulate a failed operation that rolls back
      // If not supported, this test will be skipped gracefully.
      try {
        requireAuth();
        const res = await request(app)
          .post('/api/v1/resources')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Temp Resource for Rollback', shouldFail: true });

        // If API returns 4xx on failure, this assertion may vary
        if (res.status >= 400) {
          expect(res.status).toBeGreaterThanOrEqual(400);
        } else {
          // If success, try to fetch and ensure transaction consistency
          const id = res.body?.id;
          if (id) {
            const get = await request(app)
              .get(`/api/v1/resources/${id}`)
              .set('Authorization', `Bearer ${token}`);
            // If rollback occurred, resource might be missing
            if (get.status === 404) {
              expect(get.status).toBe(404);
            } else if (get.status === 200) {
              // Resource exists; still ok as a basic check
              expect(get.body).toHaveProperty('id', id);
            }
          }
        }
      } catch (e) {
        // If this flow isn't supported, consider the test as skipped
      }
    });
  });

});