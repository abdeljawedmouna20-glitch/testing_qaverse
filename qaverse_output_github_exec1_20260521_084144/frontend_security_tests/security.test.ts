import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Common XSS payloads
const XSS_PAYLOADS = [
  "<script>alert('XSS')</script>",
  "\"/><script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg onload=alert(1)></svg>",
  "';alert(1);//"
];

// Helper: detect dialogs (XSS execution) during tests
async function hasDialogDuringActions(page: any, actions: () => Promise<void>): Promise<boolean> {
  let dialogShown = false;
  const dialogHandler = async () => {
    dialogShown = true;
  };
  page.on('dialog', dialogHandler);
  await actions();
  page.off('dialog', dialogHandler);
  return dialogShown;
}

// 1) XSS Tests on ACTUAL input fields and innerHTML usage
test.describe('Frontend Security: XSS Tests', () => {
  test('XSS - Input fields should not execute payloads (negative test)', async ({ page }) => {
    await page.goto(BASE_URL);
    // Attach dialog listener
    let dialogOccurred = false;
    page.on('dialog', async (dialog) => {
      dialogOccurred = true;
      await dialog.dismiss();
    });

    // Collect focusable inputs
    const inputSelectors = 'input:not([type="hidden"]), textarea, [contenteditable="true"]';
    const inputs = page.locator(inputSelectors);
    const count = await inputs.count();

    // If no inputs exist, skip gracefully
    if (count === 0) {
      test.skip('No input fields detected on page for XSS negative test');
    }

    for (let i = 0; i < count; i++) {
      const el = inputs.nth(i);
      for (const payload of XSS_PAYLOADS) {
        // Try to set value
        const tagName = await el.evaluate((node) => (node as HTMLElement).tagName.toLowerCase());
        if (tagName === 'input' || tagName === 'textarea') {
          try {
            await el.fill(payload);
          } catch {
            // If fill fails (e.g., disabled), continue gracefully
          }
        } else {
          // contenteditable
          try {
            await el.click();
            await el.evaluate((node, val) => {
              (node as HTMLElement).innerText = val;
            }, payload);
          } catch {
            // ignore
          }
        }

        // Blur to trigger potential validation sanitization
        await page.keyboard.press('Tab');
        // Small wait to process any inline scripts
        await page.waitForTimeout(100);

        if (dialogOccurred) {
          // Vulnerability detected in negative test
          // Fail the test if an XSS alert dialog appeared
          test.fail(true, 'XSS vulnerability detected: payload executed via input field');
        }
      }
    }

    // If no dialog appeared, assume inputs are sanitized for the tested payloads
    expect(dialogOccurred).toBeFalsy();
  });

  test('XSS - Reflection via URL parameter (innerHTML) should not render raw payload', async ({ page }) => {
    // Attempt to reflect payloads via URL parameter
    for (const payload of XSS_PAYLOADS) {
      const url = `${BASE_URL}/?name=${encodeURIComponent(payload)}`;
      await page.goto(url);

      // Get the full HTML to check for raw payload rendering in DOM
      const html = await page.content();
      // If the raw payload string appears in HTML, it indicates unsafe rendering
      if (html.includes(payload)) {
        test.fail(true, `XSS vulnerability detected via URL reflection: payload ${payload} found in HTML`);
      }
      // Alternatively, check for visible rendering of payload
      // Note: if app escapes properly, payload won't render as executable tag
      const textContent = await page.locator('body').innerText();
      expect(textContent).not.toContain(payload);
    }
  });
});

// 2) CSRF Protection Tests
test.describe('Frontend Security: CSRF Protection', () => {
  test('CSRF - POST requests include CSRF token header when submitting a form', async ({ page }) => {
    const capturedHeaders: Record<string, string> | null = null;

    // Intercept POST requests to capture headers
    const context = page.context();
    await page.route('**/*', (route, request) => {
      // Capture only the first POST
      if (request.method().toUpperCase() === 'POST' && !capturedHeaders) {
        // @ts-ignore
        (capturedHeaders as any) = request.headers();
      }
      route.continue();
    });

    await page.goto(BASE_URL);

    // Find a POST form if present
    const form = page.locator('form[method="post"], form[method="POST"]');
    const formCount = await form.count();
    if (formCount === 0) {
      test.skip('No POST form found on page to test CSRF protection');
      return;
    }

    const firstForm = form.nth(0);

    // Populate inputs if any
    const inputs = firstForm.locator('input, textarea, select');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const inp = inputs.nth(i);
      try {
        await inp.fill('test');
      } catch {
        // ignore
      }
    }

    // Submit the form
    try {
      await firstForm.evaluate((f: HTMLFormElement) => f.submit());
    } catch {
      // ignore
    }

    // Allow some time for request to be captured
    await page.waitForTimeout(1000);

    // Validate CSRF header presence
    expect(capturedHeaders).not.toBeNull();
    const headers: Record<string, string> = capturedHeaders as any;
    const hasCsrf = Object.keys(headers).some((k) => /csrf|xsrf|token/i.test(k));
    expect(hasCsrf).toBeTruthy();
  });
});

// 3) Security Headers Verification
test.describe('Frontend Security: Security Headers', () => {
  test('Security headers are present and compliant', async ({ request }) => {
    const resp = await request.get(BASE_URL);
    const headers = resp.headers();

    // CSP
    expect(headers['content-security-policy'] || headers['Content-Security-Policy']).toBeTruthy();

    // Frame options
    expect(headers['x-frame-options'] || headers['X-Frame-Options']).toBeTruthy();

    // Content type guarding
    expect(headers['x-content-type-options'] || headers['X-Content-Type-Options']).toBeTruthy();

    // Referrer policy
    expect((headers['referrer-policy'] || headers['Referrer-Policy'] || '').length > 0).toBeTruthy();
  });

  test('Security headers include CSP directives (script-src and frame-ancestors)', async ({ request }) => {
    const resp = await request.get(BASE_URL);
    const csp = resp.headers()['content-security-policy'] || resp.headers()['Content-Security-Policy'] || '';
    expect(csp).toContain('script-src');
    expect(csp).toContain('frame-ancestors');
  });

  test('Clickjacking protection via headers', async ({ request }) => {
    const resp = await request.get(BASE_URL);
    const xfo = resp.headers()['x-frame-options'] || resp.headers()['X-Frame-Options'];
    // Either X-Frame-Options or CSP frame-ancestors should be present
    expect(xfo).toBeTruthy();
  });
});

// 4) Client-side Validation Tests
test.describe('Frontend Security: Client-side Validation', () => {
  test('Validation messages appear for required fields on blur', async ({ page }) => {
    await page.goto(BASE_URL);
    const requiredFields = page.locator('input[required], textarea[required], select[required]');
    const count = await requiredFields.count();
    if (count === 0) {
      test.skip('No required fields present on page');
      return;
    }

    for (let i = 0; i < count; i++) {
      const field = requiredFields.nth(i);
      // Clear and blur to trigger native validation
      try {
        // Try to clear if possible
        const tag = await field.evaluate((el) => (el as HTMLElement).tagName.toLowerCase());
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          await field.fill('');
        }
      } catch {
        // ignore
      }
      await page.keyboard.press('Tab');
      // Small wait for validation UI
      await page.waitForTimeout(100);

      // If any browser validation message exists, it's good UX; ensure at least aria-invalid or class present
      const isInvalid = await field.evaluate((el) => (el as any).reportValidity?.() ?? false);
      // If reportValidity is not supported or returns false, we still allow test to pass; we check for HTML validity message
      // We'll not fail strictly here to avoid false positives; we still verify that invalid state is detectable
      // If element supports validationMessage:
      const hasValidationMessage = await field.evaluate((el) => {
        try {
          return (el as HTMLInputElement).validationMessage.length > 0;
        } catch {
          return false;
        }
      });
      // At least one of the indicators should be present
      expect(isInvalid || hasValidationMessage).toBeTruthy();
    }
  });
});

// 5) Sensitive Data Exposure in Browser Storage
test.describe('Frontend Security: Storage Privacy', () => {
  test('No sensitive data exposed in localStorage or sessionStorage', async ({ page }) => {
    await page.goto(BASE_URL);

    const localKeys: string[] = await page.evaluate(() => Object.keys(localStorage));
    const riskyLocal = localKeys.filter((k) => /token|password|secret|apiKey|session/i.test(k));
    expect(riskyLocal.length).toBe(0);

    const sessionKeys: string[] = await page.evaluate(() => Object.keys(sessionStorage));
    const riskySession = sessionKeys.filter((k) => /token|password|secret|apiKey|session/i.test(k));
    expect(riskySession.length).toBe(0);
  });
});

// 6) Dangerous Functions Tests
test.describe('Frontend Security: Dangerous Functions', () => {
  test('App should not rely on eval or new Function for processing user input', async ({ page, context }) => {
    // Inject wrappers to detect usage of eval and Function
    await context.addInitScript(() => {
      (window as any).__dangerous = { usedEval: false, usedFunction: false };
      const origEval = window.eval;
      window.eval = function() {
        (window as any).__dangerous.usedEval = true;
        return origEval.apply(this, arguments as any);
      };
      const origFunction = (window as any).Function;
      (window as any).Function = function() {
        (window as any).__dangerous.usedFunction = true;
        // @ts-ignore
        return origFunction.apply(this, arguments);
      };
    });

    await page.goto(BASE_URL);
    // Wait briefly to allow possible usage
    await page.waitForTimeout(1000);

    const flags = await page.evaluate(() => (window as any).__dangerous);
    expect(flags.usedEval || flags.usedFunction).toBeFalsy();
  });
});

// 7) Reflexive Tests: Additional CSP/Clickjacking Coverage via URL
test.describe('Frontend Security: CSP/Frame Coverage', () => {
  test('CSP and Frame Ancestors presence via direct URL check', async ({ request }) => {
    const resp = await request.get(BASE_URL);
    const csp = resp.headers()['content-security-policy'] || '';
    const xfo = resp.headers()['x-frame-options'] || resp.headers()['X-Frame-Options'];
    expect(!!csp || !!xfo).toBeTruthy();
  });
});

// 8) Positive/Negative Summary for XSS and Validation (high level)
test('Frontend Security: Summary - Positive & Negative Coverage', async ({ page }) => {
  // Positive: If any dialog detected during XSS tests, mark as vulnerability
  // Negative: Ensure no unintended dialogs appear with sanitized inputs (handled in individual tests)
  await page.goto(BASE_URL);
  // Ensure baseline reachability
  expect(await page.title()).toBeTruthy();
});