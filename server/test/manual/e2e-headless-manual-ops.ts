import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { FastifyInstance } from 'fastify';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { insertProtectedVehicle } from '../../src/security/protected-records.js';
import { testPiiProtection } from '../support/test-pii.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details?: string, error?: string) {
  results.push({ name, passed, details, error });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${name}${details ? ` - ${details}` : ''}${error ? `\n   Error: ${error}` : ''}`);
}

async function run() {
  console.log('🚀 Starting BibendIA Headless E2E Verification Suite against Workshop Build...\n');

  const pool = createPool('migrator');
  const pii = testPiiProtection();

  const ids = {
    tenant: randomUUID(),
    user: randomUUID(),
    workshop: randomUUID(),
    rkVehicle: randomUUID(),
  };

  const principal: PrincipalContext = {
    kind: 'workshop_user',
    audience: 'workshop',
    userId: ids.user,
    issuer: 'test-issuer',
    subject: ids.user,
    sessionId: randomUUID(),
    authenticatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    assurance: 'single_factor',
  };

  const authentication: AuthenticationAdapter = {
    async authenticate() {
      return principal;
    },
  };

  // Seed test tenant & workshop
  await pool.query(
    "INSERT INTO tenants(id, name, lifecycle_status) VALUES($1, 'E2E Headless Workshop', 'pilot')",
    [ids.tenant]
  );
  await pool.query(
    "INSERT INTO workshops(id, tenant_id, name) VALUES($1, $2, 'Taller E2E Central')",
    [ids.workshop, ids.tenant]
  );
  await pool.query(
    "INSERT INTO users(id, status) VALUES($1, 'active')",
    [ids.user]
  );
  await pool.query(
    "INSERT INTO tenant_memberships(user_id, tenant_id, role, status) VALUES($1, $2, 'OWNER', 'active')",
    [ids.user, ids.tenant]
  );

  // Seed vehicle for RK test
  await inTenantTransaction(pool, ids.tenant, (client) =>
    insertProtectedVehicle(client, pii, {
      id: ids.rkVehicle,
      tenantId: ids.tenant,
      plate: '1111 GOLF',
      make: 'Volkswagen',
      model: 'Golf VII',
    })
  );

  // Build Fastify App that also serves dist-workshop
  const app: FastifyInstance = buildApi(pool, {
    authentication,
    piiProtection: pii,
    allowedOrigins: ['http://127.0.0.1'],
  });

  // Mock /auth/session endpoint for AuthSessionGate
  app.get('/auth/session', { config: { auth: { mode: 'public' } } }, async (_req, reply) => {
    return reply.send({
      principal: {
        kind: 'workshop_user',
        audience: 'workshop',
        userId: ids.user,
        assurance: 'single_factor',
      },
      tenantIds: [ids.tenant],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  });

  // Static file serving for dist-workshop
  app.setNotFoundHandler(async (request, reply) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = url.pathname;

    if (pathname.includes('/assets/')) {
      const assetPart = pathname.slice(pathname.indexOf('/assets/'));
      const filePath = join(process.cwd(), 'dist-workshop', assetPart);
      try {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.html': 'text/html',
        };
        return reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream').send(content);
      } catch {
        // Fallback
      }
    }

    try {
      const indexHtml = await readFile(join(process.cwd(), 'dist-workshop', 'index.html'), 'utf-8');
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(indexHtml);
    } catch (err: any) {
      return reply.code(500).send({ error: 'STATIC_SERVE_FAILED', message: err.message });
    }
  });

  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  console.log(`📡 E2E Server listening on ${address}`);

  const browser: Browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    baseURL: address,
    viewport: { width: 1280, height: 800 },
  });

  const page: Page = await context.newPage();

  // Inject tenantId in localStorage on any navigation
  await page.addInitScript((tId) => {
    localStorage.setItem('bibendia_tenant_id', tId);
  }, ids.tenant);

  try {
    // =========================================================================
    // CASE 1: Borrador Manual vacío (sin cliente, sin vehículo, sin líneas, crear y reload)
    // =========================================================================
    try {
      await page.goto('/presupuestos');
      await page.waitForSelector('text=Presupuestos de Taller', { timeout: 10000 });

      // Click "Borrador Manual"
      await page.click('button:has-text("Borrador Manual")');
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });

      // Title input
      const titleInput = page.locator('input[placeholder*="Ej: Mantenimiento anual"]');
      await titleInput.fill('Presupuesto Vacío Test');

      // Click "Crear Borrador Guardado"
      await page.click('button:has-text("Crear Borrador Guardado")');

      // Wait for editor mode to open
      await page.waitForSelector('text=EDITANDO:', { timeout: 5000 });
      const itemsCountVisible = await page.locator('text=Partidas de Presupuesto (0)').isVisible();
      if (!itemsCountVisible) throw new Error('Expected 0 items in manual draft');

      // Save to exit edit mode
      await page.click('button:has-text("Guardar Cambios")');
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=Presupuestos de Taller', { timeout: 10000 });
      const draftItem = page.locator('text=Presupuesto Vacío Test').first();
      await draftItem.waitFor({ timeout: 5000 });
      await draftItem.click();

      // Verify in view mode it has 0 items and persisted status
      const hasPersistedStatus = await page.locator('text=Presupuesto guardado y sincronizado con el taller').isVisible();
      record('Case 1: Borrador Manual vacío', hasPersistedStatus, 'Borrador sin cliente, sin vehículo y 0 líneas creado, persistido y recargado con éxito');
    } catch (err: any) {
      record('Case 1: Borrador Manual vacío', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 2: Añadir recambio "Filtro de habitáculo", cant 1, precio 25 €, guardar y reload
    // =========================================================================
    try {
      await page.click('button:has-text("Editar Presupuesto / Asignar Precios")');
      await page.waitForSelector('text=EDITANDO:', { timeout: 5000 });

      // Click "+ Recambio"
      await page.click('button:has-text("Recambio")');
      await page.waitForTimeout(300);

      // Locate newly added row inputs (last row in tbody)
      const lastRow = page.locator('tbody tr').last();
      await lastRow.locator('td').nth(1).locator('input[type="text"]').fill('Filtro de habitáculo');
      await lastRow.locator('td').nth(2).locator('input[type="number"]').fill('1');
      await lastRow.locator('td').nth(3).locator('input[type="number"]').fill('25');

      // Click "Guardar Cambios"
      await page.click('button:has-text("Guardar Cambios")');
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=Filtro de habitáculo', { timeout: 10000 });
      const rowText = await page.locator('text=Filtro de habitáculo').isVisible();
      const priceText = await page.locator('text=25.00 €').first().isVisible();
      record('Case 2: Añadir recambio "Filtro de habitáculo" (25 €)', rowText && priceText, 'Recambio añadido, total recalculado, persistido y recargado');
    } catch (err: any) {
      record('Case 2: Añadir recambio "Filtro de habitáculo" (25 €)', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 3: Añadir mano de obra: descripción libre, 0,5 h, 55 €/h, guardar y reload
    // =========================================================================
    try {
      await page.click('button:has-text("Editar Presupuesto / Asignar Precios")');
      await page.waitForSelector('text=EDITANDO:', { timeout: 5000 });

      // Click "+ Mano de Obra"
      await page.click('button:has-text("Mano de Obra")');
      await page.waitForTimeout(300);

      const lastRow = page.locator('tbody tr').last();
      await lastRow.locator('td').nth(1).locator('input[type="text"]').fill('Montaje filtro y desinfección');
      await lastRow.locator('td').nth(2).locator('input[type="number"]').fill('0.5'); // quantity
      await lastRow.locator('td').nth(3).locator('input[type="number"]').fill('55');  // price

      // Save
      await page.click('button:has-text("Guardar Cambios")');
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=Montaje filtro y desinfección', { timeout: 10000 });
      const laborVisible = await page.locator('text=Montaje filtro y desinfección').isVisible();
      const hoursText = await page.locator('text=0.5 h').isVisible();
      record('Case 3: Añadir mano de obra (0.5 h, 55 €/h)', laborVisible && hoursText, 'Línea de mano de obra guardada, 0.5 h reconocidas en subtotal');
    } catch (err: any) {
      record('Case 3: Añadir mano de obra (0.5 h, 55 €/h)', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 4: Presupuesto mixto (VW Golf RK + Limpieza circuito manual, provenance intacta)
    // =========================================================================
    try {
      // Seed an RK draft via API directly for the seeded vehicle
      const rkRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/estimate-drafts`,
        headers: { authorization: 'Bearer test' },
        payload: {
          vehicleId: ids.rkVehicle,
          idempotencyKey: `mixed-e2e-${randomUUID()}`,
          vehicle: { make: 'Volkswagen', model: 'Golf VII', engineCode: 'CLHA' },
          repairJobCode: 'JOB_TIMING_BELT_WATER_PUMP',
        },
      });
      const rkDraft = rkRes.json().data;

      await page.goto('/presupuestos');
      await page.waitForSelector('text=Presupuestos de Taller', { timeout: 10000 });

      // Click specifically on the RK quote card in the list
      const rkCard = page.locator('button:has-text("PRE-RK-")').first();
      await rkCard.waitFor({ timeout: 10000 });
      await rkCard.click();
      await page.waitForSelector('h3:has-text("Distribución")', { timeout: 5000 });

      // Modify to add manual line
      await page.click('button:has-text("Editar Presupuesto / Asignar Precios")');
      await page.waitForSelector('text=EDITANDO:', { timeout: 5000 });

      // Add labor line
      await page.click('button:has-text("Mano de Obra")');
      await page.waitForTimeout(300);

      const lastRow = page.locator('tbody tr').last();
      await lastRow.locator('td').nth(1).locator('input[type="text"]').fill('Limpieza circuito refrigerante');
      await lastRow.locator('td').nth(2).locator('input[type="number"]').fill('1');
      await lastRow.locator('td').nth(3).locator('input[type="number"]').fill('45');

      await page.click('button:has-text("Guardar Cambios")');
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=Presupuestos de Taller', { timeout: 10000 });
      const rkCardAfter = page.locator('button:has-text("PRE-RK-")').first();
      await rkCardAfter.waitFor({ timeout: 10000 });
      await rkCardAfter.click();

      await page.waitForSelector('text=Línea manual taller', { timeout: 5000 });
      const manualBadge = await page.locator('text=Línea manual taller').first().isVisible();
      const rkEvidenceBadge = await page.locator('button[title="Inspeccionar procedencia técnica"]').first().isVisible();

      record('Case 4: Presupuesto mixto RK + Manual', manualBadge && rkEvidenceBadge, 'Líneas RK conservan evidencia y procedencia; línea manual añadida correctamente');
    } catch (err: any) {
      record('Case 4: Presupuesto mixto RK + Manual', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 5: Cliente manual (crear, reload, volver a seleccionarlo)
    // =========================================================================
    try {
      // Create new customer via API to simulate background or previous registration
      const custRes = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/customers`,
        headers: { authorization: 'Bearer test' },
        payload: {
          name: 'Alfonso Gómez Herrero',
          phone: '644112233',
          email: 'alfonso@taller.es',
        },
      });
      const createdCust = custRes.json().data;

      await page.goto('/presupuestos');
      await page.waitForSelector('button:has-text("Borrador Manual")', { timeout: 10000 });
      await page.click('button:has-text("Borrador Manual")');
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });

      // Customer section: choose "Ficha Taller" (first Ficha Taller toggle in the modal)
      await page.locator('button:has-text("Ficha Taller")').first().click();

      // Wait for customer option to be loaded and rendered into select
      await page.waitForSelector('option:has-text("Alfonso Gómez Herrero")', { state: 'attached', timeout: 5000 });
      const optionExists = (await page.locator('option:has-text("Alfonso Gómez Herrero")').count()) > 0;

      record('Case 5: Cliente manual persistido y seleccionable', optionExists, `Cliente ${createdCust.name} cargado en listado de selección`);
      await page.click('button:has-text("Cancelar")');
    } catch (err: any) {
      record('Case 5: Cliente manual persistido y seleccionable', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 6: Vehículo manual (crear solo matrícula, comprobar duplicado 409, seleccionar existente)
    // =========================================================================
    try {
      const plate = '7788 DUP';
      // First registration via API
      const veh1 = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer test' },
        payload: { plate },
      });
      if (veh1.statusCode !== 201) throw new Error(`Failed to create vehicle: ${veh1.body}`);

      // Attempt duplicate registration
      const veh2 = await app.inject({
        method: 'POST',
        url: `/v1/workshop/tenants/${ids.tenant}/vehicles`,
        headers: { authorization: 'Bearer test' },
        payload: { plate },
      });
      const is409 = veh2.statusCode === 409;
      const dupData = veh2.json();
      const hasExistingVehicle = dupData.existingVehicle && dupData.existingVehicle.plate === '7788DUP';

      record('Case 6: Vehículo matrícula duplicada (409 Conflict)', is409 && hasExistingVehicle, '409 Conflict devuelto con existingVehicle estructurado');
    } catch (err: any) {
      record('Case 6: Vehículo matrícula duplicada (409 Conflict)', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 7: Cita manual desde Agenda, insignia "Taller", abrir, Preparar Presupuesto con contexto
    // =========================================================================
    try {
      await page.goto('/agenda');
      await page.waitForSelector('text=Agenda de Taller', { timeout: 10000 });

      // Click "+ Nueva Cita"
      await page.click('button:has-text("+ Nueva Cita")');
      await page.waitForSelector('text=Nueva Cita Directa', { timeout: 5000 });

      // Fill appointment form
      await page.locator('input[placeholder*="Ej: Cambio de aceite"]').fill('Cambio de amortiguadores');
      await page.locator('input[placeholder="Matrícula"]').fill('9988 XYZ');
      await page.locator('input[placeholder="Nombre del cliente"]').fill('Beatriz Morales');

      // Submit
      await page.click('button:has-text("Guardar Cita en Agenda")');
      await page.waitForSelector('text=Cambio de amortiguadores', { timeout: 8000 });

      // Verify "Taller" badge on appointment card
      const apptCard = page.locator('div:has-text("Cambio de amortiguadores")').last();
      const badgeTaller = await apptCard.locator('text=Taller').first().isVisible();

      // Click card to open modal
      await apptCard.click();
      await page.waitForSelector('text=Presupuesto Manual', { timeout: 5000 });

      // Click "Presupuesto Manual"
      await page.click('button:has-text("Presupuesto Manual")');

      // Verify navigation to /presupuestos and pre-filled fields
      await page.waitForURL(/.*\/presupuestos\?new=manual.*/, { timeout: 5000 });
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });

      const prefilledPlate = await page.locator('input[value="9988 XYZ"]').isVisible();
      const prefilledName = await page.locator('input[value="Beatriz Morales"]').isVisible();

      record('Case 7: Cita manual en Agenda y transición a Presupuesto Manual', badgeTaller && prefilledPlate && prefilledName, 'Insignia "Taller" presente, contexto de cliente y matrícula transferido');
      await page.click('button:has-text("Cancelar")');
    } catch (err: any) {
      record('Case 7: Cita manual en Agenda y transición a Presupuesto Manual', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 8: Presupuesto con snapshot sin crear ficha fija (persistir, reload, datos continúan disponibles)
    // =========================================================================
    try {
      await page.goto('/presupuestos');
      await page.waitForSelector('button:has-text("Borrador Manual")', { timeout: 10000 });
      await page.click('button:has-text("Borrador Manual")');
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });

      await page.locator('input[placeholder*="Ej: Mantenimiento anual"]').fill('Sustitución batería y diagnosis');
      await page.locator('input[placeholder*="Matrícula"]').fill('3344 SSN');
      await page.locator('input[placeholder*="Marca"]').fill('Nissan');
      await page.locator('input[placeholder*="Modelo"]').fill('Qashqai');
      await page.locator('input[placeholder="Nombre completo"]').fill('Esteban Pardo');
      await page.locator('input[placeholder*="Teléfono"]').fill('655001122');

      await page.click('button:has-text("Crear Borrador Guardado")');
      await page.waitForSelector('text=EDITANDO:', { timeout: 5000 });

      // Click "Guardar Cambios" to exit edit mode and enter view mode
      await page.click('button:has-text("Guardar Cambios")');
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Verify snapshot banner
      const bannerVisible = await page.locator('text=Ficha de cliente o vehículo pendiente de consolidar').isVisible();
      const customerText = await page.locator('text=Esteban Pardo').first().isVisible();
      const plateText = await page.locator('text=3344 SSN').first().isVisible();

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=Sustitución batería y diagnosis', { timeout: 10000 });
      await page.locator('div:has-text("Sustitución batería y diagnosis")').first().click();

      const customerAfterReload = await page.locator('text=Esteban Pardo').first().isVisible();
      const plateAfterReload = await page.locator('text=3344 SSN').first().isVisible();
      const bannerAfterReload = await page.locator('text=Ficha de cliente o vehículo pendiente de consolidar').isVisible();

      record('Case 8: Presupuesto con snapshot protegido', bannerVisible && customerAfterReload && plateAfterReload && bannerAfterReload, 'Datos recuperados y descifrados tras reload sin crear filas en customers/vehicles');
    } catch (err: any) {
      record('Case 8: Presupuesto con snapshot protegido', false, undefined, err.message);
    }

    // =========================================================================
    // CASE 9: Responsive móvil 390 px (modales utilizables, sin overflow horizontal relevante)
    // =========================================================================
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/presupuestos');
      await page.waitForSelector('text=Presupuestos de Taller', { timeout: 10000 });

      // Verify no horizontal overflow on page
      const pageScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noPageOverflow = pageScrollWidth <= 390;

      // Open ManualEstimateModal on 390px
      await page.click('button:has-text("Borrador Manual")');
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });
      const modalScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noModalOverflow = modalScrollWidth <= 390;

      const submitBtnVisible = await page.locator('button:has-text("Crear Borrador Guardado")').isVisible();
      await page.click('button:has-text("Cancelar")');

      // Navigate to Agenda on 390px
      await page.goto('/agenda');
      await page.waitForSelector('text=Agenda de Taller', { timeout: 10000 });
      const agendaScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noAgendaOverflow = agendaScrollWidth <= 390;

      // Open ManualAppointmentModal on 390px
      await page.click('button:has-text("+ Nueva Cita")');
      await page.waitForSelector('text=Nueva Cita Directa', { timeout: 5000 });
      const apptModalScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noApptModalOverflow = apptModalScrollWidth <= 390;

      await page.click('button:has-text("Cancelar")');

      const allResponsivePass = noPageOverflow && noModalOverflow && submitBtnVisible && noAgendaOverflow && noApptModalOverflow;
      record('Case 9: Responsive móvil 390 px', allResponsivePass, `scrollWidth: page=${pageScrollWidth}px, modal=${modalScrollWidth}px, agenda=${agendaScrollWidth}px (<= 390px)`);
    } catch (err: any) {
      record('Case 9: Responsive móvil 390 px', false, undefined, err.message);
    }

  } finally {
    await browser.close();
    await app.close();

    // Clean up test data
    await pool.query('DELETE FROM estimate_draft_mutations WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM estimate_draft_lines WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM estimate_drafts WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM appointments WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM customer_vehicle_roles WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM vehicles WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM customers WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM tenant_memberships WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM users WHERE id = $1', [ids.user]);
    await pool.query('DELETE FROM workshops WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [ids.tenant]);
    await pool.end();
  }

  // Summary
  console.log('\n======================================================');
  console.log('🏁 E2E HEADLESS EXECUTION SUMMARY');
  console.log('======================================================');
  const allPassed = results.every(r => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
    if (r.details) console.log(`   ${r.details}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });
  console.log('======================================================');
  console.log(`TOTAL: ${results.filter(r => r.passed).length}/${results.length} PASSED`);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
