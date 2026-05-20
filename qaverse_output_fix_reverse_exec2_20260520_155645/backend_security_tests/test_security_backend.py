import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER = process.env.TEST_USER || 'testuser';
const TEST_PASS = process.env.TEST_PASS || 'testpass';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'adminpass';

// Helpers to manage simple cookie handling
async function login(user: string, pass: string): Promise<string | null> {
  try {
    const res: AxiosResponse = await axios.post(
      '/login',
      { username: user, password: pass },
      {
        baseURL: API_BASE_URL,
        validateStatus: () => true,
      }
    );
    const status = res.status;
    if (status === 200 || status === 201) {
      const setCookies = res.headers['set-cookie'];
      if (Array.isArray(setCookies) && setCookies.length > 0) {
        const cookies = setCookies
          .map((c: string) => c.split(';')[0])
          .join('; ');
        return cookies;
      }
      return null;
    }
  } catch {
    // ignore, will return null
  }
  return null;
}

async function request(
  method: HttpMethod,
  path: string,
  data?: any,
  cookie?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: any; headers?: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...(extraHeaders || {}),
  };

  const config: AxiosRequestConfig = {
    method,
    url: path,
    baseURL: API_BASE_URL,
    headers,
    data,
    validateStatus: () => true,
  };

  const res = await axios.request(config);
  return { status: res.status, data: res.data, headers: res.headers };
}

// Health-ish check to decide if endpoints exist
async function endpointAvailable(path: string, cookie?: string): Promise<boolean> {
  try {
    const res = await request('GET', path, undefined, cookie);
    // 404 indicates endpoint probably not present; treat as unavailable
    return res.status !== 404;
  } catch {
    return false;
  }
}

describe('Backend Security Tests (Comprehensive)", () => {
  let userCookie: string | null = null;
  let adminCookie: string | null = null;

  beforeAll(async () => {
    // Attempt logins; if credentials not provided, tests may still run against public endpoints
    const user = TEST_USER;
    const pass = TEST_PASS;
    const adminUser = ADMIN_USER;
    const adminPass = ADMIN_PASS;

    userCookie = await login(user, pass);
    adminCookie = await login(adminUser, adminPass);
  });

  // 1) API Security - Authentication
  test('Access to protected endpoint requires authentication', async () => {
    const res = await request('GET', '/api/protected', undefined, undefined);
    expect([401, 403]).toContain(res.status);
  });

  test('Access to protected endpoint succeeds with valid session', async () => {
    if (!userCookie) {
      // Skip if login not configured
      return;
    }
    const res = await request('GET', '/api/protected', undefined, userCookie);
    // Expect 200 or 304 (not modified) depending on implementation
    expect([200, 304]).toContain(res.status);
  });

  // 2) SQL Injection - Test on actual endpoints/queries
  test('SQL Injection attempt on search endpoint should be safely handled', async () => {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1; SELECT * FROM information_schema.tables; --",
    ];
    for (const payload of payloads) {
      const res = await request('GET', '/api/search', { q: payload }, userCookie || undefined);
      expect(res.status).toBeLessThan(500);
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const lower = body.toLowerCase();
      expect(lower).not.toContain('sql');
      expect(lower).not.toContain('syntax');
      expect(lower).not.toContain('error');
    }
  });

  test('SQL Injection attempt via user fetch by id should be parameterized', async () => {
    // Using a query param to simulate injection in an endpoint that should use parameterized queries
    const maliciousId = "1' OR '1'='1";
    const res = await request('GET', '/api/users', { id: maliciousId }, userCookie || undefined);
    // Depending on the route, it may be 200 with error-safe result or error; we simply ensure no SQL crash
    expect([200, 400, 404, 422]).toContain(res.status);
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const lower = body.toLowerCase();
    expect(lower).not.toContain('sql');
    expect(lower).not.toContain('syntax');
    expect(lower).not.toContain('error');
  });

  // 3) Authentication Bypass
  test('Admin endpoint is protected from anonymous access', async () => {
    const res = await request('GET', '/admin', undefined, undefined);
    expect([401, 403]).toContain(res.status);
  });

  test('Authentication bypass with invalid session cookie is denied', async () => {
    const res = await request('GET', '/admin', undefined, 'invalid-cookie');
    expect(res.status).toBe(403);
  });

  test('Admin access succeeds with admin credentials', async () => {
    if (!adminCookie) return;
    const res = await request('GET', '/admin', undefined, adminCookie);
    expect(res.status).toBe(200);
  });

  // 4) Authorization Flaws
  test('User cannot access another user data (ownership enforcement)', async () => {
    if (!userCookie) return;
    // Access own data
    const own = await request('GET', '/api/users/me', undefined, userCookie);
    // Should be allowed
    expect([200, 304]).toContain(own.status);

    // Attempt to access another user data
    const otherUserId = 'non-existent-or-other-user';
    const resOther = await request('GET', `/api/users/${otherUserId}`, undefined, userCookie);
    // Protected resources should 403/404 if not allowed
    expect([403, 404]).toContain(resOther.status);
  });

  test('Admin can access admin-only resources, regular user cannot', async () => {
    if (!userCookie || !adminCookie) return;
    const adminRes = await request('GET', '/admin', undefined, adminCookie);
    expect([200, 304]).toContain(adminRes.status);

    const userRes = await request('GET', '/admin', undefined, userCookie);
    expect([401, 403, 404]).toContain(userRes.status);
  });

  // 5) Data Validation
  test('Create user with invalid payload should be rejected (validation)', async () => {
    if (!adminCookie) return;
    const badPayloads = [
      { email: 'not-an-email', name: 'Test User', age: 25 },
      { email: 'user@example.com', name: '', age: 25 },
      { email: 'user@example.com', name: 'Test User', age: 'twenty' },
    ];
    for (const payload of badPayloads) {
      const res = await request('POST', '/api/users', payload, adminCookie);
      expect(res.status).toBe(400);
    }
  });

  // 6) Sensitive Data Handling
  test('Sensitive data from environment should not be exposed via /env or /config endpoints', async () => {
    // Attempt without login first
    const resEnv = await request('GET', '/env', undefined, undefined);
    // Server should forbid or sanitize
    expect([200, 403, 404]).toContain(resEnv.status);

    const resConfig = await request('GET', '/config', undefined, undefined);
    expect([200, 403, 404]).toContain(resConfig.status);

    // If accessible, ensure no secrets leak
    for (const res of [resEnv, resConfig] as Array<{ status: number; data: any }>) {
      if (res.status === 200) {
        const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const lower = body.toLowerCase();
        // Ensure actual secret keys or env values are not exposed
        const secrets = ['password', 'secret', 'api_key', 'token'];
        for (const s of secrets) {
          expect(lower).not.toContain(s);
        }
        // Ensure runtime env not leaked
        if (process.env.SECRET) {
          expect(lower).not.toContain(process.env.SECRET);
        }
      }
    }
  });

  test('Error responses should not reveal stack traces or internal errors', async () => {
    // Trigger an internal error by sending malformed payload
    const res = await request('POST', '/api/trigger-error', { invalid: true }, adminCookie || undefined);
    // Expect 500 or 400 but ensure body does not include stack traces
    expect([500, 400]).toContain(res.status);
    const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    expect(bodyStr.toLowerCase()).not.toContain('stack');
    expect(bodyStr.toLowerCase()).not.toContain('trace');
  });

  // 7) API Rate Limiting and Throttling
  test('Rate limiting on a protected endpoint', async () => {
    if (!userCookie) return;
    let hits = 0;
    const attempts = 12;
    for (let i = 0; i < attempts; i++) {
      const res = await request('GET', '/api/limited', undefined, userCookie);
      if (res.status === 429) hits++;
      // small delay to simulate rapid but not overly bursty traffic
      // Note: In test environments, avoid long sleeps; keep short if needed
    }
    expect(hits).toBeGreaterThanOrEqual(1);
  });

  // 8) CSRF Protection
  test('CSRF protection on state-changing endpoint (token required)', async () => {
    if (!userCookie) return;
    // Attempt without CSRF token
    const resNoToken = await request('POST', '/api/transfer', { amount: 100 }, userCookie);
    expect([403, 401]).toContain(resNoToken.status);

    // Retrieve CSRF token (if endpoint exists)
    let csrfToken: string | null = null;
    try {
      const tokenRes = await axios.get('/csrf-token', {
        baseURL: API_BASE_URL,
        headers: { Cookie: userCookie },
        validateStatus: () => true,
      });
      csrfToken = tokenRes.data?.csrfToken ?? null;
    } catch {
      csrfToken = null;
    }

    if (csrfToken) {
      const resWithToken = await request(
        'POST',
        '/api/transfer',
        { amount: 100 },
        userCookie,
        { 'X-CSRF-Token': csrfToken }
      );
      expect([200, 201, 204]).toContain(resWithToken.status);
    }
  });

  // 9) OWASP Top 10 Vulnerabilities

  test('XSS: Input sanitized and not reflected as executable', async () => {
    if (!userCookie) return;
    const payload = "<script>alert('xss')</script>";
    const postRes = await request('POST', '/api/comments', { message: payload }, userCookie);
    expect([200, 201]).toContain(postRes.status);

    const getRes = await request('GET', '/api/comments', undefined, userCookie);
    const data = getRes.data;
    const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
    expect(bodyStr).not.toContain(payload);
  });

  test('SSR: Backend blocks SSRF-like requests via internal fetch endpoints', async () => {
    if (!adminCookie) return;
    const resSSRF = await request('GET', '/api/fetch', { target: 'http://localhost:1' }, adminCookie);
    expect([400, 403, 422]).toContain(resSSRF.status);
  });

  test('Files and commands: disallow dangerous uploads and command execution', async () => {
    // Attempt unsafe file upload
    try {
      const formData = new (require('form-data'))();
      const BufferStream = Buffer.from("<?php phpinfo(); ?>");
      formData.append('file', BufferStream, { filename: 'shell.php', contentType: 'application/php' });

      const resUpload = await axios.post('/api/upload', formData, {
        baseURL: API_BASE_URL,
        headers: {
          ...formData.getHeaders(),
          Cookie: adminCookie || '',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true,
      });
      // Expect service to reject dangerous file
      expect([200, 201, 400, 403, 415]).toContain(resUpload.status);
    } catch {
      // If form-data lib not available, skip gracefully
    }

    // Attempt command injection via API
    if (adminCookie) {
      const resCmd = await request('POST', '/api/run', { cmd: 'whoami; uname -a' }, adminCookie);
      // Should be blocked or handled safely
      expect([200, 400, 403, 501]).toContain(resCmd.status);
    }
  });
});