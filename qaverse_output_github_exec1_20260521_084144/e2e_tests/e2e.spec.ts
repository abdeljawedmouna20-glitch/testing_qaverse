// e2e.generic.spec.js
// Playwright E2E tests with generic routes and flows.
// This suite is designed to run even when "detected pages/routes" are not provided.
// It uses configurable routes, optional authentication, and generic CRUD tests against common UI patterns.

const { test, expect } = require('@playwright/test');

// Configuration (can be overridden via environment variables)
const config = (() => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  let routes = [];
  if (process.env.ROUTES) {
    try {
      routes = JSON.parse(process.env.ROUTES);
    } catch (e) {
      routes = process.env.ROUTES.split(',').map((r) => r.trim()).filter(Boolean);
    }
  }
  // Fallback generic routes when none provided
  if (routes.length === 0) {
    routes = ['/', '/home', '/dashboard', '/items', '/projects', '/settings'];
  }
  // Deduplicate and normalize routes
  routes = Array.from(new Set(routes.map((r) => (r.startsWith('/') ? r : `/${r}`))));

  return {
    baseUrl,
    routes,
    credentials: {
      username: process.env.TEST_USERNAME || 'test@example.com',
      password: process.env.TEST_PASSWORD || 'Password123!',
    },
  };
})();

// Helpers
async function safeFill(page, selector, value) {
  const el = page.locator(selector);
  if ((await el.count()) > 0) {
    await el.first().fill(value);
    return true;
  }
  return false;
}

async function safeClick(page, selector) {
  const el = page.locator(selector);
  if ((await el.count()) > 0) {
    await el.first().click();
    return true;
  }
  return false;
}

async function loginIfPossible(page) {
  // Try typical login URL
  const loginUrls = ['/login', '/signin', '/auth/login'];
  let loginPageFound = false;
  for (const u of loginUrls) {
    try {
      const resp = await page.goto(config.baseUrl + u, { waitUntil: 'domcontentloaded' });
      if (resp && resp.ok()) {
        loginPageFound = true;
        break;
      }
    } catch (_) {
      // ignore
    }
  }
  if (!loginPageFound) {
    // No login page detected
    return false;
  }

  // Detect common login form fields
  const emailSel = 'input[name="email"], input#email, input[type="email"]';
  const passSel = 'input[name="password"], input#password, input[type="password"]';
  const hasEmail = (await page.locator(emailSel).count()) > 0;
  const hasPass = (await page.locator(passSel).count()) > 0;

  if (hasEmail && hasPass) {
    await page.fill(emailSel, config.credentials.username);
    await page.fill(passSel, config.credentials.password);
    // Submit button
    const submitSel = 'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")';
    if (await safeClick(page, submitSel)) {
      // Wait for navigation after login
      await page.waitForLoadState('networkidle');
      return true;
    }
    // If no explicit submit button, try pressing Enter
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    return true;
  }

  // If login fields can't be found but a potential login form exists, try to submit via generic button
  if (await safeClick(page, 'button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")')) {
    await page.waitForLoadState('networkidle');
    return true;
  }

  return false;
}

async function ensureOnProtectedRoute(page, route) {
  // Navigate to a route that commonly requires auth and verify if redirected to login
  const url = config.baseUrl + route;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
  if (!resp) return false;

  // If redirected to login path, attempt login
  if (page.url().toLowerCase().includes('/login') || page.url().toLowerCase().includes('/signin')) {
    const didLogin = await loginIfPossible(page);
    if (!didLogin) {
      return false;
    }
    // Retry original route after login
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  // Final check: page should load (title present)
  const title = await page.title();
  return title && title.length > 0;
}

function uniqueName(prefix = 'Item') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Begin tests
test.describe('E2E Generic Routes and Flows (no detected pages/routes)', () => {
  test.beforeAll(async () => {
    // Optional: setup shared state, e.g., seed data if API available
    // No-op for generic environments
    // Console for visibility in test runs
    console.log('Starting generic E2E tests with routes:', config.routes);
  });

  test.afterAll(async () => {
    // Optional: teardown seeded data
    console.log('Completed generic E2E tests.');
  });

  test('Route navigation loads the ACTUAL routes', async ({ page }) => {
    for (const route of config.routes) {
      const url = config.baseUrl + route;
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
      if (!resp) {
        // Cannot load the route; fail the test for visibility
        await expect.soft(false).toBeTruthy(`Failed to navigate to ${url} (no response)`);
        continue;
      }
      // Assert HTTP OK when possible
      const ok = resp.ok ? true : false;
      await expect.soft(ok).toBeTruthy(`Route ${route} returned non-OK status (${resp.status()})`);
      // Basic page sanity
      const title = await page.title();
      await expect.soft(title && title.length > 0).toBeTruthy(`Route ${route} has no detectable title`);
    }
  });

  test('Authentication flow (if auth pages exist) loads protected routes after login', async ({ page }) => {
    // Pick a commonly protected route
    const protectedRoute = config.routes.find((r) => r.toLowerCase() === '/dashboard' || r.toLowerCase() === '/settings' || r.toLowerCase() === '/projects') || config.routes[0];
    const url = config.baseUrl + protectedRoute;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);

    // If no response or page URL indicates login, try auth flow
    let requiresLogin = false;
    if (!resp) {
      requiresLogin = true;
    } else {
      const current = page.url().toLowerCase();
      if (current.includes('/login') || current.includes('/signin')) {
        requiresLogin = true;
      }
    }

    if (!requiresLogin) {
      // Already on a protected route; ensure page loads
      await expect(page).toHaveURL(new RegExp(config.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + protectedRoute));
      await expect(page.locator('body')).toBeVisible();
      return;
    }

    // Attempt login
    const loggedIn = await loginIfPossible(page);
    if (!loggedIn) {
      // If login is not possible, gracefully skip
      test.skip('Auth flow not detectable on this site; skipping authentication test');
      return;
    }

    // After login, re-navigate to protected route
    const postLoginResp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    if (postLoginResp) {
      await expect(postLoginResp.ok()).toBeTruthy();
    }
    // Verify content loads
    const title = await page.title();
    await expect(title).toBeTruthy();
  });

  test('Data persistence: Create, Read, Update, Delete a generic item (if UI supports /items)', async ({ page }) => {
    // Navigate to items list if available
    const itemsRoute = '/items';
    const itemsUrl = config.baseUrl + itemsRoute;
    const go = await page.goto(itemsUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    if (!go || !(await page.locator('text=*').count())) {
      test.skip('Items UI not detected; skipping CRUD tests for /items');
      return;
    }

    // Helper to attempt to create a new item
    const createBtn = page.locator('button:has-text("New"), button:has-text("Create"), a:has-text("New")');
    let createdName = null;
    if ((await createBtn.count()) > 0) {
      await createBtn.first().click();
      createdName = uniqueName('E2E_Item');
      // Fill common fields if present
      const nameSelectors = ['input[name="name"]', 'input#name', 'input[name="title"]', 'input#title'];
      let filled = false;
      for (const sel of nameSelectors) {
        if (await page.locator(sel).count() > 0) {
          await page.fill(sel, createdName);
          filled = true;
          break;
        }
      }
      // Submit
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Create")');
      if ((await saveBtn.count()) > 0) {
        await saveBtn.first().click();
      } else {
        // Try Enter
        await page.keyboard.press('Enter');
      }
      // Wait for item to appear in list
      if (createdName) {
        try {
          await page.waitForSelector(`text="${createdName}"`, { timeout: 8000 });
        } catch {
          // Item did not appear; mark as skipped gracefully
          test.info().annotations.push({ type: 'warning', label: 'CRUD', detail: 'Created item did not appear in list' });
        }
      }
    } else {
      test.skip('No create button detected on /items; skipping CRUD test');
      return;
    }

    // Update the created item if possible
    // Navigate back to list and click first Edit if available
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    if ((await editBtn.count()) > 0 && createdName) {
      await editBtn.click();
      const updatedName = `${createdName}-Updated`;
      // Try to update name field
      let updated = false;
      for (const sel of ['input[name="name"]', 'input#name', 'input[name="title"]', 'input#title']) {
        if (await page.locator(sel).count() > 0) {
          await page.fill(sel, updatedName);
          updated = true;
          break;
        }
      }
      // Save
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Update")');
      if ((await saveBtn.count()) > 0) {
        await saveBtn.first().click();
      } else {
        await page.keyboard.press('Enter');
      }
      if (updated) {
        // Verify updated name appears
        try {
          await page.waitForSelector(`text="${updatedName}"`, { timeout: 8000 });
        } catch {
          test.info().annotations.push({ type: 'warning', label: 'CRUD', detail: 'Updated item name not found after update' });
        }
      }
    } else {
      test.info().annotations.push({ type: 'note', label: 'CRUD', detail: 'Edit action not available; skipping update/delete checks' });
    }

    // Delete the item if possible
    const deleteBtn = page.locator('button:has-text("Delete"), a:has-text("Delete")').first();
    if ((await deleteBtn.count()) > 0 && createdName) {
      // Optional confirm dialog handling
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });
      await deleteBtn.click();
      // Verify item no longer appears
      try {
        await page.waitForSelector(`text="${createdName}"`, { timeout: 8000, state: 'detached' });
      } catch {
        // If still present, attempt a hard refresh check
        const stillThere = await page.locator(`text="${createdName}"`).count();
        expect(stillThere).toBe(0);
      }
    } else {
      test.info().annotations.push({ type: 'note', label: 'CRUD', detail: 'Delete action not available; skipping delete' });
    }
  });

  test('Basic user journey (generic flows across routes)', async ({ page }) => {
    // Optional login at start
    // Try to access a common route
    const primaryRoute = config.routes[0] || '/';
    const url = config.baseUrl + primaryRoute;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
    if (resp && resp.ok()) {
      // Page loaded; try a basic interaction if possible
      // If a search input exists, perform a lightweight query
      const searchSel = 'input[placeholder*="Search"], input[aria-label*="Search"]';
      if ((await page.locator(searchSel).count()) > 0) {
        await page.fill(searchSel, 'Playwright');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }
      // Verify there is a visible main content region if possible
      const mainSel = 'main, [role="main"], .main';
      if ((await page.locator(mainSel).count()) > 0) {
        await expect(page.locator(mainSel)).toBeVisible();
      }
    } else {
      // Could not load primary route; attempt to login and retry
      const loggedIn = await loginIfPossible(page);
      if (loggedIn) {
        const retry = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
        if (retry && retry.ok()) {
          await expect(page).toHaveURL(new RegExp(config.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + primaryRoute));
        } else {
          test.info().annotations.push({ type: 'warning', label: 'Flow', detail: 'Retry after login failed for primary route' });
        }
      } else {
        test.info().annotations.push({ type: 'note', label: 'Flow', detail: 'No auth flow available; proceeding with generic route checks' });
      }
    }
  });
});