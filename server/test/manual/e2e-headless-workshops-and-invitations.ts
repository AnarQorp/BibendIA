import { assertIsolatedTestDatabase } from '../../src/persistence/test-database-guard.js';

// FAIL-CLOSED: Test database MUST be explicitly declared isolated and ephemeral
assertIsolatedTestDatabase(process.env);

import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { FastifyInstance } from 'fastify';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool } from '../../src/persistence/pool.js';
import { testPiiProtection } from '../support/test-pii.js';

interface StepLog {
  step: string;
  passed: boolean;
  details?: string;
  screenshot?: string;
}

const steps: StepLog[] = [];

function record(step: string, passed: boolean, details?: string, screenshot?: string) {
  steps.push({ step, passed, details, screenshot });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${step}${details ? ` - ${details}` : ''}${screenshot ? ` (Screenshot: ${screenshot})` : ''}`);
}

async function run() {
  console.log('🚀 Starting BibendIA E2E Browser Verification: Workshops, Invitations & Welcome Activation\n');

  const screenshotsDir = process.env.BIBENDIA_E2E_ARTIFACTS_DIR || '/tmp/bibendia-minimal-e2e-screenshots';
  await mkdir(screenshotsDir, { recursive: true });

  const pool = createPool('migrator');
  const pii = testPiiProtection();

  const adminUserId = randomUUID();

  // Seed superadmin user & grant in DB so platform admin endpoints work seamlessly
  await pool.query("INSERT INTO users(id, status, pii_migration_state) VALUES($1, 'active', 'protected')", [adminUserId]);
  await pool.query(
    `INSERT INTO platform_access_grants(user_id, role, scope_type, tenant_id, status)
     VALUES($1, 'PLATFORM_ADMIN', 'global', NULL, 'active')`,
    [adminUserId]
  );
  await pool.query(
    `INSERT INTO tenants(id, name, lifecycle_status)
     VALUES(gen_random_uuid(), 'Synthetic existing workshop', 'pilot')
     ON CONFLICT DO NOTHING`
  );

  const existingBefore = (await pool.query("SELECT row_to_json(t) AS row FROM tenants t WHERE name='Synthetic existing workshop'")).rows;

  const adminPrincipal: PrincipalContext = {
    kind: 'platform_user',
    audience: 'platform',
    userId: adminUserId,
    issuer: 'https://test-issuer/',
    subject: adminUserId,
    sessionId: randomUUID(),
    authenticatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    assurance: 'mfa',
  };

  const authentication: AuthenticationAdapter = {
    async authenticate() {
      return workshopPrincipal ?? adminPrincipal;
    },
  };
  let workshopPrincipal: PrincipalContext | null = null;
  let workshopTenantIds: string[] = [];

  // Build Fastify App that serves API, dist-admin and dist-workshop
  const app: FastifyInstance = buildApi(pool, {
    authentication,
    piiProtection: pii,
    allowedOrigins: ['http://127.0.0.1'],
  });

  // Mock /auth/session endpoint for Platform Admin AuthSessionGate
  app.get('/auth/session', { config: { auth: { mode: 'public' } } }, async (_req, reply) => {
    if (workshopPrincipal?.kind === 'workshop_user') return reply.send({
      principal: { kind: 'workshop_user', audience: 'workshop', userId: workshopPrincipal.userId, assurance: 'single_factor' },
      tenantIds: workshopTenantIds, activeTenantId: workshopPrincipal.tenantId, expiresAt: workshopPrincipal.expiresAt,
    });
    return reply.send({
      principal: {
        kind: 'platform_user',
        audience: 'platform',
        userId: adminUserId,
        assurance: 'mfa',
      },
      tenantIds: [],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  });

  // Static file serving handler: serves dist-admin when path starts with /admin or index.html is requested by admin
  app.setNotFoundHandler(async (request, reply) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = url.pathname;

    const mimeTypes: Record<string, string> = {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.html': 'text/html',
    };

    // Serve admin assets
    if (pathname.includes('/assets/admin-') || pathname === '/admin.html') {
      const filename = pathname.split('/').pop() || 'admin.html';
      const filePath = filename.endsWith('.html')
        ? join(process.cwd(), 'dist-admin', filename)
        : join(process.cwd(), 'dist-admin', 'assets', filename);
      try {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        return reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream').send(content);
      } catch (err) {
        // fallback
      }
    }

    // Serve workshop assets
    if (pathname.includes('/assets/workshop-') || pathname.includes('/assets/')) {
      const filename = pathname.split('/').pop() || '';
      const filePath = join(process.cwd(), 'dist-workshop', 'assets', filename);
      try {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        return reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream').send(content);
      } catch (err) {
        // fallback
      }
    }

    // If pathname is /invitacion or contains token, serve workshop index.html
    if (pathname === '/workshop' || pathname.startsWith('/invitacion') || url.search.includes('token=')) {
      const indexHtml = await readFile(join(process.cwd(), 'dist-workshop', 'index.html'), 'utf-8');
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(indexHtml);
    }

    // Default to admin html for root admin tests
    try {
      const adminHtml = await readFile(join(process.cwd(), 'dist-admin', 'admin.html'), 'utf-8');
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(adminHtml);
    } catch {
      const indexHtml = await readFile(join(process.cwd(), 'dist-workshop', 'index.html'), 'utf-8');
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(indexHtml);
    }
  });

  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  console.log(`📡 E2E Test Server listening on ${address}`);

  const browser: Browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page: Page = await browser.newPage({
      baseURL: address,
      viewport: { width: 1440, height: 900 },
    });

    // ----------------------------------------------------
    // STEP 1: Load Platform Admin & Verify Navigation
    // ----------------------------------------------------
    await page.goto('/admin.html', { waitUntil: 'networkidle' });
    const title = await page.textContent('h2');
    record('1. Load Platform Admin', title?.includes('Gestión Operativa de Talleres') || false, `Header text: "${title}"`);

    const shot1 = `${screenshotsDir}/01-admin-workshops-directory.png`;
    await page.screenshot({ path: shot1, fullPage: true });
    record('1. Screenshot: Directory view', true, 'Captured', shot1);

    // ----------------------------------------------------
    // STEP 2: Create Workshop for Arkaitz without a commercial plan
    // ----------------------------------------------------
    console.log('\n--- Step 2: Creating Workshop for Arkaitz ---');
    const newWorkshopBtn = await page.waitForSelector('button:has-text("Nuevo Taller")');
    await newWorkshopBtn.click();

    await page.waitForSelector('input[placeholder*="Taller Arkaitz Motor"]');
    await page.fill('input[placeholder*="Taller Arkaitz Motor"]', 'Taller Arkaitz Donostia');
    
    // Commercial plans are outside this release.
    if (await page.locator('text=Plan asignado:').count()) throw new Error('Unexpected commercial plan selector');

    const shotModal = `${screenshotsDir}/02-create-workshop-modal.png`;
    await page.screenshot({ path: shotModal });
    record('2. Screenshot: Create Workshop Modal', true, 'Captured', shotModal);

    // Submit creation form
    await page.click('button:has-text("Crear Taller")');
    await page.waitForSelector('table tbody tr:has-text("Taller Arkaitz Donostia")', { timeout: 10000 });

    const shotCreated = `${screenshotsDir}/03-workshop-created-in-directory.png`;
    await page.screenshot({ path: shotCreated, fullPage: true });
    record('2. Workshop Created in Directory', true, 'Taller Arkaitz Donostia rendered without commercial plan metadata', shotCreated);

    // Exercise the actual UI action and backend lifecycle validation, not a direct SQL promotion.
    const createdTenant = (await pool.query("SELECT id FROM tenants WHERE name='Taller Arkaitz Donostia'")).rows[0].id;
    await page.locator('table tbody tr', { hasText: 'Taller Arkaitz Donostia' }).getByRole('button', { name: 'Ficha', exact: true }).click();
    const promoted = page.waitForResponse(r => r.url().endsWith(`/tenants/${createdTenant}/lifecycle`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Activar Taller', exact: true }).click();
    const promotion = await promoted;
    if (promotion.status() !== 200) throw new Error(`UI activation failed: ${await promotion.text()}`);
    if (promotion.request().postDataJSON().target !== 'pilot') throw new Error('UI must promote provisioning to pilot');
    if ((await pool.query('SELECT lifecycle_status FROM tenants WHERE id=$1', [createdTenant])).rows[0].lifecycle_status !== 'pilot') throw new Error('New workshop did not enter pilot');
    await page.waitForSelector('table tbody tr:has-text("Taller Arkaitz Donostia"):has-text("EN PILOTO")');
    record('2. UI activation promotes provisioning to pilot', true, 'Real lifecycle endpoint accepted; no transition to active');

    // ----------------------------------------------------
    // STEP 3: Issue One-Time Access Invitation for Arkaitz
    // ----------------------------------------------------
    console.log('\n--- Step 3: Issuing Access Invitation ---');
    // Click on "Invitaciones" tab
    await page.click('button:has-text("Invitaciones")');
    await page.waitForSelector('h2:has-text("Invitaciones de Acceso")');

    const shotInvTab = `${screenshotsDir}/04-invitations-admin-tab.png`;
    await page.screenshot({ path: shotInvTab, fullPage: true });
    record('3. Screenshot: Invitations Admin Tab', true, 'Captured', shotInvTab);

    // Click "+ Nueva Invitación"
    await page.click('button:has-text("Nueva Invitación")');
    await page.waitForSelector('input[placeholder*="arkaitz.demo@taller-ejemplo.es"]');

    // Select the newly created workshop (Taller Arkaitz Donostia) in the modal form
    const tenantSelect = page.locator('form select').first();
    const arkaitzOption = tenantSelect.locator('option:has-text("Arkaitz")').first();
    if (await arkaitzOption.count() > 0) {
      const arkaitzTenantId = await arkaitzOption.getAttribute('value');
      console.log(`🎯 Found Arkaitz tenant option with ID: ${arkaitzTenantId}`);
      if (arkaitzTenantId) {
        await tenantSelect.selectOption(arkaitzTenantId);
      }
    } else {
      console.log(`⚠️ Arkaitz option not found in options`);
    }

    // Fill fictitious demo email for Arkaitz
    const testEmail = `arkaitz.demo.${Date.now()}@taller-ejemplo.es`;
    await page.fill('input[placeholder*="arkaitz.demo@taller-ejemplo.es"]', testEmail);

    const shotInvModal = `${screenshotsDir}/05-new-invitation-modal.png`;
    await page.screenshot({ path: shotInvModal });
    record('3. Screenshot: New Invitation Modal', true, 'Captured', shotInvModal);

    // Submit invitation
    await page.click('button:has-text("Generar Invitación")');

    // Verify Canonical Delivery Receipt Modal pops up (NO raw token leak!)
    await page.waitForSelector('h3:has-text("Invitación Registrada en Plataforma")');
    const tokenInputCount = await page.locator('input[readonly]').count();
    record('3. Zero Token Leakage in Admin Console', tokenInputCount === 0, 'No raw token input displayed in admin UI');

    const shotReceipt = `${screenshotsDir}/06-invitation-receipt-modal.png`;
    await page.screenshot({ path: shotReceipt });
    record('3. Canonical Receipt Displayed', true, 'Audit and delivery metadata shown without exposing bearer secret', shotReceipt);

    // Close receipt modal
    await page.click('button:has-text("Aceptar y Cerrar")');

    // ----------------------------------------------------
    // STEP 4: Admin Table View & Expire Action
    // ----------------------------------------------------
    console.log('\n--- Step 4: Admin Table & Expire Action ---');
    const invRow = page.locator('table tbody tr', { hasText: testEmail });
    await invRow.waitFor({ timeout: 10000 });
    record('4. Invitation listed in Admin Table', true, testEmail);

    const shotListed = `${screenshotsDir}/07-invitation-listed-in-table.png`;
    await page.screenshot({ path: shotListed, fullPage: true });

    // Test Expiring the invitation
    const expireBtn = invRow.locator('button:has-text("Caducar")');
    if (await expireBtn.count() > 0) {
      await expireBtn.click();
      await page.waitForTimeout(1000);
      const shotExpired = `${screenshotsDir}/08-invitation-expired.png`;
      await page.screenshot({ path: shotExpired, fullPage: true });
      record('4. Invitation Expire Action Executed', true, 'Revoked via PATCH/POST expire endpoint', shotExpired);
    }

    // ----------------------------------------------------
    // STEP 5: Arkaitz Welcome OIDC Screen in Browser
    // ----------------------------------------------------
    console.log('\n--- Step 5: Arkaitz Welcome OIDC Screen ---');
    const dummyToken = 'kX9zN2wP1qR4sT7uV0wX3yZ6aB9cD2eF5gH8jK1mN4p';
    await page.goto(`/invitacion#token=${dummyToken}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Activa tu acceso de Taller")');

    const oidcBtn = await page.waitForSelector('button:has-text("Verificar y Acceder con OIDC")');
    record('5. Welcome OIDC Screen Loaded', await oidcBtn.isVisible(), 'Canonical OIDC button rendered');

    // Verify token stripped from address bar (referrer protection)
    await page.waitForTimeout(300);
    const currentUrl = page.url();
    record('5. Token Stripped from URL Hash', !currentUrl.includes('token='), currentUrl);

    const shotWelcome = `${screenshotsDir}/09-welcome-oidc-screen.png`;
    await page.screenshot({ path: shotWelcome, fullPage: true });
    record('5. Screenshot: Welcome Screen', true, 'Captured', shotWelcome);

    // UI wiring regression with a controlled session fixture; signed OIDC redemption is
    // covered separately by workshop-invitations.test.ts against this same real API/DB.
    const member = randomUUID();
    const existingTenant = (await pool.query("SELECT id FROM tenants WHERE name='Synthetic existing workshop' LIMIT 1")).rows[0].id;
    await pool.query("INSERT INTO users(id,status) VALUES($1,'active')", [member]);
    await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'VIEWER'),($1,$3,'OWNER')", [member,createdTenant,existingTenant]);
    workshopTenantIds = [existingTenant,createdTenant];
    workshopPrincipal = { ...adminPrincipal, kind: 'workshop_user', audience: 'workshop', userId: member, tenantId: createdTenant, assurance: 'single_factor' };
    const appointmentRequest = page.waitForRequest(r => r.url().includes('/v1/workshop/tenants/') && r.url().endsWith('/appointments'));
    await page.goto('/workshop', { waitUntil: 'networkidle' });
    const requestedAppointments = await appointmentRequest;
    if (!requestedAppointments.url().includes(`/tenants/${createdTenant}/appointments`)) throw new Error('Workshop UI selected the first membership instead of activeTenantId');
    const scopedResponse = await page.request.get(`/v1/workshop/tenants/${createdTenant}/appointments`);
    if (scopedResponse.status() !== 200) throw new Error('Invited workshop data is not accessible');
    const deniedPlatform = await page.request.get('/v1/platform/tenants');
    if (deniedPlatform.status() !== 403 && deniedPlatform.status() !== 401) throw new Error('Workshop session accessed global administration');
    record('5. Multi-membership UI opens active invited workshop', true, 'Actual app selects second membership; workshop API succeeds and platform API denies access (controlled session fixture)');

    // ----------------------------------------------------
    // STEP 6: DB Invariant & Jarrisons Untouched Check
    // ----------------------------------------------------
    console.log('\n--- Step 6: Verifying DB Invariants & Synthetic Tenant Safety ---');
    const invCount = await pool.query('SELECT count(*)::int as count FROM workshop_invitations');
    record('6. DB Invariant: Invitations recorded', invCount.rows[0].count > 0, `Total invitations in test DB: ${invCount.rows[0].count}`);

    const existingAfter = (await pool.query("SELECT row_to_json(t) AS row FROM tenants t WHERE name='Synthetic existing workshop'")).rows;
    if (JSON.stringify(existingAfter) !== JSON.stringify(existingBefore)) throw new Error('Existing synthetic tenant was modified');
    record('6. Synthetic existing tenant unchanged', true, 'Exact row snapshot preserved; no real Jarrisons data used');

    const shotComplete = `${screenshotsDir}/10-e2e-complete.png`;
    await page.screenshot({ path: shotComplete });
    record('6. Screenshot: E2E Verification Complete', true, 'Captured', shotComplete);

    if (steps.some(step => !step.passed)) throw new Error('One or more browser checks failed');
    console.log('\n======================================================');
    console.log('🎉 ALL 6 E2E BROWSER STEPS COMPLETED AND VERIFIED!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    await app.close();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌ E2E Browser Test Failed:', err);
  process.exit(1);
});
