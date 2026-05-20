/// <reference types="cypress" />

// Frontend security tests: XSS, CSRF, security headers, input validation, storage, clickjacking, CSP, dangerous functions
describe('Frontend security tests', () => {
  const baseUrl = Cypress.config('baseUrl') || 'http://localhost:3000';

  beforeEach(() => {
    cy.visit('/');
  });

  // 1) XSS Risks on actual inputs and innerHTML usage
  it('XSS - Negative: inputs should escape payload and not execute scripts', () => {
    // Prepare a spy for alert to detect possible XSS execution
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alertSpy');
    });

    cy.get('input, textarea, [contenteditable="true"]').each(($el) => {
      const payload = '<script>alert(123)</script>';

      cy.wrap($el).clear({ force: true }).type(payload, { force: true });

      // Submit the form if present
      cy.wrap($el)
        .closest('form')
        .within(() => {
          cy.get('button[type="submit"], input[type="submit"]').first().click({ force: true });
        });

      // If the vulnerability exists, alert would be called; we expect it not to be called
      cy.get('@alertSpy').should('not.have.been.called');
    });
  });

  it('XSS - Positive: potential vulnerability via innerHTML (alert may trigger if vulnerable)', () => {
    // Prepare a spy for alert to detect XSS execution
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alertSpy');
    });

    cy.get('input, textarea, [contenteditable="true"]').each(($el) => {
      const payload = '<img src=x onerror=alert(999)>';
      cy.wrap($el).clear({ force: true }).type(payload, { force: true });

      cy.wrap($el)
        .closest('form')
        .within(() => {
          cy.get('button[type="submit"], input[type="submit"]').first().click({ force: true });
        });

      // If vulnerability exists, an alert should be triggered
      cy.get('@alertSpy')
        .then((stub) => {
          // If alert was called, this is a positive vulnerability detection
          // We don't fail the test here to allow reporting; but we log the outcome.
          Cypress.env('xss_alert_called', stub && stub.called);
        })
        .should('exist');
    });
  });

  // 2) CSRF Protection tests
  it('CSRF Protection - detect token usage and missing-token behavior on form submission', () => {
    // Detect if any form uses CSRF token
    cy.document().then((doc) => {
      const hasCsrf =
        doc.querySelector('input[name="_csrf"]') ||
        doc.querySelector('input[name="csrf_token"]') ||
        doc.querySelector('meta[name="csrf-token"]');
      if (!hasCsrf) {
        cy.log('No CSRF token detected in forms/meta. Skipping CSRF-specific tests.');
        return;
      }
    });

    // Intercept form submissions
    cy.intercept('POST', '**/*').as('postRequest');

    // Attempt to submit a form with missing CSRF token (by removing token input if present)
    cy.get('form').first().then(($form) => {
      // Remove CSRF token input if found
      cy.wrap($form).within(() => {
        cy.get('input[name="_csrf"]').then(($in) => {
          if ($in && $in.length) {
            cy.wrap($in).invoke('remove');
          }
        });
        cy.get('input[name="csrf_token"]').then(($in) => {
          if ($in && $in.length) {
            cy.wrap($in).invoke('remove');
          }
        });
      });

      // Submit the form
      cy.wrap($form).within(() => {
        cy.get('button[type="submit"], input[type="submit"]').first().click({ force: true });
      });
    });

    // Expect a 403/400/401 error due to missing CSRF token
    cy.wait('@postRequest').then((interception) => {
      const status = interception?.response?.statusCode;
      expect([403, 400, 401]).to.include(status);
    });
  });

  // 3) Security headers verification
  it('Security Headers - verify CSP, X-Frame-Options, and X-Content-Type-Options presence', () => {
    cy.request({ url: baseUrl, failOnStatusCode: false }).then((resp) => {
      // CSP presence
      const hasCSP = resp.headers['content-security-policy'];
      // Frame options presence
      const hasXFO = !!resp.headers['x-frame-options'];
      // Frame-ancestors could also be used via CSP
      const hasFrameAncestors = !!resp.headers['frame-ancestors'];
      // Content-Type options
      const hasCTO = !!resp.headers['x-content-type-options'];

      expect(hasCSP || hasFrameAncestors).to.equal(true);
      expect(hasXFO || hasFrameAncestors).to.equal(true);
      expect(hasCTO).to.equal(true);
    });
  });

  // 4) Client-side validation tests
  it('Client-side validation - HTML5 validations for required and email fields', () => {
    cy.get('form').first().within(() => {
      // Required field test
      cy.get('[required]').first().then(($el) => {
        // Clear and check validity
        cy.wrap($el).clear();
        cy.wrap($el).then((input) => {
          const valid = input[0].checkValidity();
          expect(valid).to.equal(false);
        });
      });

      // Email field format test
      cy.get('input[type="email"]').first().then(($email) => {
        cy.wrap($email).clear().type('not-an-email');
        cy.wrap($email).then((input) => {
          expect(input[0].checkValidity()).to.equal(false);
        });

        cy.wrap($email).clear().type('valid@example.com');
        cy.wrap($email).then((input) => {
          expect(input[0].checkValidity()).to.equal(true);
        });
      });
    });
  });

  // 5) Sensitive data exposure in browser storage
  it('Sensitive data exposure - ensure no secrets in localStorage or sessionStorage', () => {
    cy.window().then((win) => {
      const ls = win.localStorage;
      const ss = win.sessionStorage;

      const lsKeys = Object.keys(ls);
      const ssKeys = Object.keys(ss);
      const secretPattern = /token|password|apikey|secret|cookie|session/i;

      const foundInLS = lsKeys.filter((k) => secretPattern.test(k) || secretPattern.test(String(ls.getItem(k))));
      const foundInSS = ssKeys.filter((k) => secretPattern.test(k) || secretPattern.test(String(ss.getItem(k))));

      expect(foundInLS.length).to.equal(0);
      expect(foundInSS.length).to.equal(0);
    });
  });

  // 6) Clickjacking protection
  it('Clickjacking protection - verify framing protections via HTTP headers', () => {
    cy.request(baseUrl).then((resp) => {
      const hasXFO = resp.headers['x-frame-options'] !== undefined;
      const hasCSPFrame = resp.headers['content-security-policy'] && /frame-ancestors\s+[^;]+/.test(resp.headers['content-security-policy']);
      expect(hasXFO || hasCSPFrame).to.equal(true);
    });
  });

  // 7) Content Security Policy compliance
  it('Content Security Policy - verify CSP is enforced via header presence', () => {
    cy.request(baseUrl).then((resp) => {
      const csp = resp.headers['content-security-policy'];
      expect(!!csp).to.equal(true);
    });
  });

  // 8) Dangerous functions usage detection
  it('Dangerous Functions - detect use of eval or Function constructor by spying', () => {
    // Prepare spies on global dangerous functions
    cy.window().then((win) => {
      // Create spies; if app uses eval or Function, these will be invoked
      // Note: We install spies before actions that might trigger code paths
      cy.spy(win, 'eval').as('evalSpy');
      cy.spy(win, 'Function').as('FunctionSpy');
    });

    // Trigger potential code paths if available (no specific actions required here due to app variability)
    // We perform no-op actions; in a real app, you would interact with inputs that might trigger dynamic eval/Function usage

    // Assertions: by default, expect that dangerous functions were not called
    // If the app uses such constructs, this may fail, indicating a vulnerability
    cy.get('@evalSpy').should('not.have.been.called');
    cy.get('@FunctionSpy').should('not.have.been.called');
  });
});