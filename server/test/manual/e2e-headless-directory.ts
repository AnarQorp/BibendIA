import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { FastifyInstance } from 'fastify';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool } from '../../src/persistence/pool.js';
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
  console.log('🚀 Starting BibendIA Headless E2E Verification Suite for Workshop Directory...\n');

  const pool = createPool('migrator');
  const pii = testPiiProtection();

  const ids = {
    tenant: randomUUID(),
    user: randomUUID(),
    workshop: randomUUID(),
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
    "INSERT INTO tenants(id, name, lifecycle_status) VALUES($1, 'E2E Directory Workshop', 'pilot')",
    [ids.tenant]
  );
  await pool.query(
    `INSERT INTO workshops(id, tenant_id, name, timezone, opening_hours, service_duration_policy, capacity_policy)
     VALUES($1, $2, 'Taller Directorio Central', 'UTC',
       '{"1":[{"start":"00:00","end":"23:59"}],"2":[{"start":"00:00","end":"23:59"}],"3":[{"start":"00:00","end":"23:59"}],"4":[{"start":"00:00","end":"23:59"}],"5":[{"start":"00:00","end":"23:59"}],"6":[{"start":"00:00","end":"23:59"}],"7":[{"start":"00:00","end":"23:59"}]}'::jsonb,
       '{"version":"v1","rules":{"inspection":60,"oil_service":45,"brakes_or_noise":90,"generic_fault":60},"fallbackMinutes":60}'::jsonb,
       '{"version":"v1","liftCount":2,"nonLiftBayCount":2,"concurrentTechnicians":2,"maxVehiclesOnSite":8,"maxVehicleIntakesPerHour":3,"resourceRequirements":{"rules":{"inspection":{"mechanic":1,"lift":0,"genericBay":1},"oil_service":{"mechanic":1,"lift":1,"genericBay":0},"brakes_or_noise":{"mechanic":1,"lift":1,"genericBay":0},"generic_fault":{"mechanic":1,"lift":0,"genericBay":1}},"fallback":{"mechanic":1,"lift":0,"genericBay":1}}}'::jsonb)`,
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

  let createdCustomerId: string | null = null;
  let createdVehicleId: string | null = null;

  try {
    // =========================================================================
    // STEP 1: Navegación a /directorio tab Clientes
    // =========================================================================
    try {
      await page.goto('/directorio');
      await page.waitForSelector('text=Directorio del Taller', { timeout: 10000 });
      const clientesTab = page.locator('div.inline-flex button:has-text("Clientes")');
      const vehiculosTab = page.locator('div.inline-flex button:has-text("Vehículos")');
      const hasClientesTab = await clientesTab.isVisible();
      const hasVehiculosTab = await vehiculosTab.isVisible();
      const hasTitle = await page.locator('h1:has-text("Directorio del Taller")').isVisible();

      record('Paso 1: Navegación a /directorio tab Clientes', hasClientesTab && hasVehiculosTab && hasTitle, 'Cabecera Directorio y tabs Clientes/Vehículos visibles');
    } catch (err: any) {
      record('Paso 1: Navegación a /directorio tab Clientes', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 2: Crear cliente "Laura Sánchez" (phone 600123456, email laura@ejemplo.com)
    // =========================================================================
    try {
      await page.locator('button:has-text("Nuevo cliente")').click();
      await page.waitForSelector('text=Nuevo Cliente en Taller', { timeout: 5000 });

      const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Cliente en Taller' });
      await modal.locator('input[placeholder*="Laura Sánchez Martín"]').fill('Laura Sánchez');
      await modal.locator('input[placeholder*="600123456"]').fill('600123456');
      await modal.locator('input[placeholder*="laura@ejemplo.com"]').fill('laura@ejemplo.com');
      await modal.locator('textarea[placeholder*="Observaciones"]').fill('Contacto inicial taller');

      await modal.locator('button:has-text("Guardar Cliente")').click();
      await modal.waitFor({ state: 'detached', timeout: 5000 });

      // Verify appears in list
      await page.waitForSelector('text=Laura Sánchez', { timeout: 5000 });
      const nameVisible = await page.locator('text=Laura Sánchez').first().isVisible();

      // Check DB for AES encryption (zero plaintext PII)
      const dbCust = await pool.query(
        'SELECT id, display_name_ciphertext, phone_ciphertext, phone_lookup_digest FROM customers WHERE tenant_id = $1',
        [ids.tenant]
      );
      createdCustomerId = dbCust.rows[0]?.id;
      const isEncrypted = dbCust.rows.length === 1 &&
        Buffer.isBuffer(dbCust.rows[0].display_name_ciphertext) &&
        dbCust.rows[0].phone_lookup_digest !== null;

      record('Paso 2: Crear cliente "Laura Sánchez"', nameVisible && isEncrypted, `Cliente creado, visible en UI y cifrado AES-256 en BD (ID: ${createdCustomerId})`);
    } catch (err: any) {
      record('Paso 2: Crear cliente "Laura Sánchez"', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 3: Abrir Ficha Laura Sánchez, editar notas a "Llamar por las tardes", guardar y reload
    // =========================================================================
    try {
      // Click on customer card to open drawer
      await page.locator('text=Laura Sánchez').first().click();
      await page.waitForSelector('text=Datos de Contacto', { timeout: 5000 });

      // Edit notes
      const ficha = page.locator('div.bg-slate-50.border.border-slate-200').filter({ hasText: 'Datos de Contacto' });
      const notesArea = ficha.locator('textarea[placeholder*="Preferencias de contacto"]');
      await notesArea.fill('Llamar por las tardes');

      // Click "Guardar cambios"
      await ficha.locator('button:has-text("Guardar cambios")').click();
      await page.waitForSelector('text=Datos del cliente actualizados con éxito.', { timeout: 5000 });

      // Reload page and verify persistence
      await page.reload();
      await page.waitForSelector('text=Laura Sánchez', { timeout: 10000 });
      await page.locator('text=Laura Sánchez').first().click();
      await page.waitForSelector('text=Datos de Contacto', { timeout: 5000 });

      const updatedNotes = await page.locator('textarea[placeholder*="Preferencias de contacto"]').inputValue();
      const notesPersisted = updatedNotes === 'Llamar por las tardes';

      // Close drawer for next step
      await page.locator('button[title="Cerrar ficha"]').click();
      await page.waitForTimeout(300);

      record('Paso 3: Ficha Laura Sánchez, edición inline y persistencia', notesPersisted, 'Notas actualizadas a "Llamar por las tardes" y persistidas tras recarga');
    } catch (err: any) {
      record('Paso 3: Ficha Laura Sánchez, edición inline y persistencia', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 4: Sugerencia no bloqueante de duplicado de teléfono con "Laura Familiar"
    // =========================================================================
    try {
      await page.locator('button:has-text("Nuevo cliente")').click();
      await page.waitForSelector('text=Nuevo Cliente en Taller', { timeout: 5000 });

      const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Cliente en Taller' });
      await modal.locator('input[placeholder*="Laura Sánchez Martín"]').fill('Laura Familiar');
      await modal.locator('input[placeholder*="600123456"]').fill('600123456');

      await modal.locator('button:has-text("Guardar Cliente")').click();

      // Duplicate suggestion banner should appear inside modal
      await modal.locator('text=Posible cliente existente encontrado:').waitFor({ timeout: 5000 });
      const duplicateNoticeVisible = await modal.locator('text=Laura Sánchez').isVisible();
      const hasUseExistingBtn = await modal.locator('button:has-text("Usar cliente existente")').isVisible();
      const hasCreateAnywayBtn = await modal.locator('button:has-text("Crear de todos modos")').isVisible();

      // Click "Usar cliente existente"
      await modal.locator('button:has-text("Usar cliente existente")').click();
      await modal.waitFor({ state: 'detached', timeout: 5000 });

      record('Paso 4: Sugerencia de duplicado no bloqueante de teléfono', duplicateNoticeVisible && hasUseExistingBtn && hasCreateAnywayBtn, 'Aviso de cliente existente detectado sin 409 y resuelto interactivamente');
    } catch (err: any) {
      record('Paso 4: Sugerencia de duplicado no bloqueante de teléfono', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 5: Navegación a tab Vehículos
    // =========================================================================
    try {
      const vehiculosTab = page.locator('div.inline-flex button:has-text("Vehículos")');
      await vehiculosTab.click();
      await page.waitForSelector('text=No hay vehículos encontrados', { timeout: 5000 });
      const emptyVehiclesVisible = await page.locator('text=No hay vehículos encontrados').isVisible();

      record('Paso 5: Navegación a tab Vehículos', emptyVehiclesVisible, 'Tab Vehículos activado y empty state correcto');
    } catch (err: any) {
      record('Paso 5: Navegación a tab Vehículos', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 6: Crear vehículo solo matrícula "7788BBB"
    // =========================================================================
    try {
      await page.locator('button:has-text("Añadir vehículo")').first().click();
      await page.waitForSelector('text=Nuevo Vehículo en Taller', { timeout: 5000 });

      const vehModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Vehículo en Taller' });
      await vehModal.locator('input[placeholder="1234BBB"]').fill('7788BBB');
      await vehModal.locator('button:has-text("Guardar Vehículo")').click();
      await vehModal.waitFor({ state: 'detached', timeout: 5000 });

      // Verify in list
      await page.waitForSelector('text=7788BBB', { timeout: 5000 });
      const plateBadgeVisible = await page.locator('text=7788BBB').first().isVisible();
      const unassignedVisible = (await page.locator('text=Sin cliente asociado').first().isVisible()) ||
                                (await page.locator('text=titular asociado').first().isVisible());

      const dbVeh = await pool.query(
        'SELECT id, plate_ciphertext, plate_lookup_digest FROM vehicles WHERE tenant_id = $1',
        [ids.tenant]
      );
      createdVehicleId = dbVeh.rows[0]?.id;
      const isEncrypted = dbVeh.rows.length === 1 &&
        Buffer.isBuffer(dbVeh.rows[0].plate_ciphertext) &&
        dbVeh.rows[0].plate_lookup_digest !== null;

      record('Paso 6: Crear vehículo solo matrícula (7788BBB)', plateBadgeVisible && unassignedVisible && isEncrypted, `Vehículo creado con matrícula cifrada, badge español visible y estado sin asignar (ID: ${createdVehicleId})`);
    } catch (err: any) {
      record('Paso 6: Crear vehículo solo matrícula (7788BBB)', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 7: Abrir Ficha 7788BBB, completar datos (Renault Clio, 2020, VIN), guardar y reload
    // =========================================================================
    try {
      await page.locator('text=7788BBB').first().click();
      await page.waitForSelector('text=Ficha Técnica y Matrícula', { timeout: 5000 });

      const ficha = page.locator('div.bg-slate-50.border.border-slate-200').filter({ hasText: 'Ficha Técnica y Matrícula' });
      await ficha.locator('input[placeholder="Renault"]').fill('Renault');
      await ficha.locator('input[placeholder="Megane IV"]').fill('Clio');
      await ficha.locator('input[placeholder="2018"]').fill('2020');
      await ficha.locator('input[placeholder="VF1..."]').fill('VF1CLIO2020XXXX01');

      await ficha.locator('button:has-text("Guardar cambios")').click();
      await page.waitForSelector('text=Datos del vehículo actualizados con éxito.', { timeout: 5000 });

      // Reload and verify
      await page.reload();
      await page.waitForSelector('text=7788BBB', { timeout: 10000 });
      await page.locator('text=7788BBB').first().click();
      await page.waitForSelector('text=Ficha Técnica y Matrícula', { timeout: 5000 });

      const makeVal = await page.locator('input[placeholder="Renault"]').inputValue();
      const modelVal = await page.locator('input[placeholder="Megane IV"]').inputValue();
      const yearVal = await page.locator('input[placeholder="2018"]').inputValue();
      const vinVal = await page.locator('input[placeholder="VF1..."]').inputValue();

      const allPersisted = makeVal === 'Renault' && modelVal === 'Clio' && yearVal === '2020' && vinVal === 'VF1CLIO2020XXXX01';
      record('Paso 7: Ficha 7788BBB, completar datos y persistencia', allPersisted, 'Datos técnicos completados (Renault Clio 2020 VIN) y verificados tras recarga');
    } catch (err: any) {
      record('Paso 7: Ficha 7788BBB, completar datos y persistencia', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 8: Conflicto de matrícula duplicada bloqueante (409) con "7788-BBB"
    // =========================================================================
    try {
      await page.locator('button:has-text("Añadir vehículo")').first().click();
      await page.waitForSelector('text=Nuevo Vehículo en Taller', { timeout: 5000 });

      const vehModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Vehículo en Taller' });
      await vehModal.locator('input[placeholder="1234BBB"]').fill('7788-BBB');
      await vehModal.locator('button:has-text("Guardar Vehículo")').click();

      // Conflict error banner should appear
      await vehModal.locator('text=ya existe').waitFor({ timeout: 5000 });
      const conflictMsgVisible = await vehModal.locator('text=ya existe').isVisible();

      await vehModal.locator('button:has-text("Cancelar")').click();
      await vehModal.waitFor({ state: 'detached', timeout: 5000 });

      record('Paso 8: Bloqueo de duplicado de matrícula (409)', conflictMsgVisible, 'Intento de alta duplicada bloqueado con mensaje descriptivo y sin error 500');
    } catch (err: any) {
      record('Paso 8: Bloqueo de duplicado de matrícula (409)', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 9: Asociar vehículo 7788BBB con Laura Sánchez vía Ficha
    // =========================================================================
    try {
      // In 7788BBB Ficha, associate owner
      const assocBtn = page.locator('button:has-text("Asociar cliente"), button:has-text("Asociar titular"), button:has-text("Cambiar titular")').first();
      await assocBtn.click();
      await page.waitForSelector('select:has-text("Selecciona un cliente del taller...")', { timeout: 5000 });

      const select = page.locator('select').first();
      await select.selectOption(createdCustomerId!);

      await page.locator('button:has-text("Vincular")').click();
      await page.waitForSelector('text=Vehículo asociado al cliente con éxito.', { timeout: 5000 });
      // Wait for vehicleDetail to finish fetching and render owner card
      await page.waitForSelector('p:has-text("Laura Sánchez")', { timeout: 5000 });
      const ownerCardVisible = await page.locator('p:has-text("Laura Sánchez")').first().isVisible();

      // Go to Clientes tab and verify 7788BBB appears under Laura Sánchez
      const clientesTab = page.locator('div.inline-flex button:has-text("Clientes")');
      await clientesTab.click();
      await page.waitForSelector('text=Laura Sánchez', { timeout: 5000 });
      await page.locator('text=Laura Sánchez').first().click();
      await page.waitForSelector('text=Vehículos del Cliente', { timeout: 5000 });
      await page.waitForSelector('text=7788BBB', { timeout: 5000 });
      const vehicleBadgeUnderCustomer = await page.locator('text=7788BBB').first().isVisible();

      // Verify DB role
      const dbRole = await pool.query(
        'SELECT role, verification_status FROM customer_vehicle_roles WHERE tenant_id = $1 AND customer_id = $2 AND vehicle_id = $3',
        [ids.tenant, createdCustomerId, createdVehicleId]
      );
      const isDbAssociated = dbRole.rows.length === 1 && dbRole.rows[0].role === 'owner' && dbRole.rows[0].verification_status === 'verified';

      record('Paso 9: Asociar vehículo a cliente vía customer_vehicle_roles', ownerCardVisible && vehicleBadgeUnderCustomer && isDbAssociated, 'Vínculo bidireccional en UI y fila canónica customer_vehicle_roles verificada');
    } catch (err: any) {
      record('Paso 9: Asociar vehículo a cliente vía customer_vehicle_roles', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 10: Crear nueva cita desde Ficha y verificar en Historial de Citas
    // =========================================================================
    try {
      // Click "Nueva cita" in Laura Sánchez Ficha (top action button)
      const apptBtn = page.locator('button:has-text("Nueva cita")').first();
      await apptBtn.click();
      await page.waitForSelector('text=Nueva Cita Directa', { timeout: 10000 });

      const apptModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nueva Cita Directa' });

      // Switch vehicle mode to saved vehicle ("Ficha Taller") using the second Ficha Taller button
      await apptModal.locator('button:has-text("Ficha Taller")').nth(1).click();
      await page.waitForTimeout(500);
      await apptModal.locator('select').last().locator(`option[value="${createdVehicleId}"]`).waitFor({ state: 'attached', timeout: 5000 });
      await apptModal.locator('select').last().selectOption(createdVehicleId!);

      // Canonical service intent. The backend remains authoritative for duration
      // and capacity requirements; the UI no longer accepts a free-text intent.
      await apptModal.locator('button:has-text("Revisión / inspección")').click();

      // Click "Guardar Cita en Agenda"
      await apptModal.locator('button:has-text("Guardar Cita en Agenda")').click();
      await apptModal.waitFor({ state: 'detached', timeout: 5000 });

      // Return to /directorio and verify appointment in Ficha
      await page.goto('/directorio');
      await page.waitForSelector('text=Laura Sánchez', { timeout: 10000 });
      await page.locator('text=Laura Sánchez').first().click();
      await page.waitForSelector('text=Historial de Citas (1)', { timeout: 5000 });

      const apptVisible = await page.locator('text=inspection').isVisible();
      const apptPlateVisible = await page.locator('text=7788BBB').first().isVisible();

      // Close drawer
      const closeFichaBtn = page.locator('button[title="Cerrar ficha"]');
      if (await closeFichaBtn.isVisible()) await closeFichaBtn.click();
      await page.waitForTimeout(200);

      record('Paso 10: Crear cita y comprobar en Historial de Citas', apptVisible && apptPlateVisible, 'Cita creada desde ficha de cliente y reflejada inmediatamente en su historial con matrícula asociada');
    } catch (err: any) {
      record('Paso 10: Crear cita y comprobar en Historial de Citas', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 11: Crear presupuesto manual desde Ficha y verificar provenance derivada
    // =========================================================================
    try {
      // Go directly to Vehículos tab
      await page.goto('/directorio?tab=vehiculos');
      await page.waitForSelector('text=7788BBB', { timeout: 10000 });
      await page.locator('text=7788BBB').first().click();
      await page.waitForSelector('text=Ficha Técnica y Matrícula', { timeout: 5000 });

      // Click "Nuevo presupuesto" inside vehicle Ficha
      const newEstimateBtn = page.locator('button:has-text("Nuevo presupuesto")').first();
      await newEstimateBtn.click();
      await page.waitForSelector('text=¿Cómo deseas confeccionar el presupuesto para este vehículo?', { timeout: 5000 });

      // Choose "Presupuesto Manual de Taller"
      await page.locator('button:has-text("Presupuesto Manual de Taller")').click();
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 5000 });

      const estModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Presupuesto Manual' });
      // Set title
      await estModal.locator('input[placeholder*="Mantenimiento anual"]').fill('Mantenimiento Preventivo 7788BBB');

      // Save draft
      await estModal.locator('button:has-text("Crear Borrador Guardado")').click();
      await page.waitForSelector('text=EDITANDO:', { timeout: 10000 });

      // Add item
      await page.locator('button:has-text("Recambio")').click();
      await page.waitForTimeout(300);

      const lastRow = page.locator('tbody tr').last();
      await lastRow.locator('td').nth(1).locator('input[type="text"]').fill('Pastillas de freno delanteras');
      await lastRow.locator('td').nth(2).locator('input[type="number"]').fill('1');
      await lastRow.locator('td').nth(3).locator('input[type="number"]').fill('65');

      await page.locator('button:has-text("Guardar Cambios")').click();
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // Return to Directorio Vehículos tab
      await page.goto('/directorio?tab=vehiculos');
      await page.waitForSelector('text=7788BBB', { timeout: 10000 });
      await page.locator('text=7788BBB').first().click();
      await page.waitForSelector('text=Historial de Presupuestos (1)', { timeout: 5000 });

      const titleVisible = await page.locator('text=Mantenimiento Preventivo 7788BBB').isVisible();
      const amountVisible = await page.locator('text=65.00 €').isVisible();
      const manualBadgeVisible = await page.locator('span:has-text("Manual")').isVisible();

      // Close drawer
      const closeFichaBtn = page.locator('button[title="Cerrar ficha"]');
      if (await closeFichaBtn.isVisible()) await closeFichaBtn.click();
      await page.waitForTimeout(200);

      record('Paso 11: Crear presupuesto manual y verificar provenance', titleVisible && amountVisible && manualBadgeVisible, 'Presupuesto creado con consolidación de entidad, total 65.00 € y provenance derivada "Manual" en ficha');
    } catch (err: any) {
      record('Paso 11: Crear presupuesto manual y verificar provenance', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 12: Headless real de Snapshot Consolidation (draft con snapshots libres -> consolidar Customer y Vehicle -> verificar version, mutations y Directorio)
    // =========================================================================
    try {
      // 1. Abrir modal de nuevo presupuesto manual sin cliente ni vehículo previos
      await page.goto('/presupuestos?new=manual');
      await page.waitForSelector('text=Nuevo Presupuesto Manual', { timeout: 10000 });

      const manualModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Presupuesto Manual' });
      await manualModal.locator('input[placeholder*="Mantenimiento anual"]').fill('Sustitución de Embrague Snapshot');
      await manualModal.locator('input[placeholder="Nombre completo"]').fill('Marcos García');
      await manualModal.locator('input[placeholder*="600112233"]').fill('611222333');
      await manualModal.locator('input[placeholder*="1234-BBB"]').fill('9911XYZ');
      await manualModal.locator('input[placeholder*="Renault"]').fill('Seat');
      await manualModal.locator('input[placeholder*="Megane"]').fill('Leon');

      // 2. Guardar borrador inicial
      await manualModal.locator('button:has-text("Crear Borrador Guardado")').click();
      await page.waitForSelector('text=EDITANDO:', { timeout: 10000 });

      // Guardar cambios del borrador para entrar en vista detalle
      await page.locator('button:has-text("Guardar Cambios")').click();
      await page.waitForSelector('text=EDITANDO:', { state: 'detached', timeout: 5000 });

      // 3. Confirmar que el draft en BD tiene customer_id = NULL y vehicle_id = NULL y version = 1
      const dbDraftInitial = await pool.query(
        'SELECT id, customer_id, vehicle_id, version FROM estimate_drafts WHERE tenant_id = $1 AND title = $2',
        [ids.tenant, 'Sustitución de Embrague Snapshot']
      );
      const snapshotDraftId = dbDraftInitial.rows[0]?.id;
      const initialNulls = dbDraftInitial.rows.length === 1 &&
        dbDraftInitial.rows[0].customer_id === null &&
        dbDraftInitial.rows[0].vehicle_id === null &&
        dbDraftInitial.rows[0].version === 1;

      // 4. Desde la UI usar "Guardar Cliente en Ficha"
      await page.waitForSelector('button:has-text("Guardar Cliente en Ficha")', { timeout: 5000 });
      await page.locator('button:has-text("Guardar Cliente en Ficha")').click();
      await page.waitForSelector('text=Nuevo Cliente en Taller', { timeout: 5000 });

      const custModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Cliente en Taller' });
      await custModal.locator('button:has-text("Guardar Cliente")').click();
      await custModal.waitFor({ state: 'detached', timeout: 5000 });
      await page.waitForSelector('text=Cliente Marcos García consolidado y vinculado', { timeout: 5000 });

      // Verificar en BD que draft tiene customer_id persistido y version = 2
      const dbDraftAfterCust = await pool.query(
        'SELECT customer_id, vehicle_id, version FROM estimate_drafts WHERE id = $1',
        [snapshotDraftId]
      );
      const consolidatedCustId = dbDraftAfterCust.rows[0]?.customer_id;
      const custConsolidated = !!consolidatedCustId &&
        dbDraftAfterCust.rows[0].vehicle_id === null &&
        dbDraftAfterCust.rows[0].version === 2;

      // 5. Desde la UI usar "Guardar Vehículo en Ficha"
      await page.waitForSelector('button:has-text("Guardar Vehículo en Ficha")', { timeout: 5000 });
      await page.locator('button:has-text("Guardar Vehículo en Ficha")').click();
      await page.waitForSelector('text=Nuevo Vehículo en Taller', { timeout: 5000 });

      const vehModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Vehículo en Taller' });
      await vehModal.locator('button:has-text("Guardar Vehículo")').click();
      await vehModal.waitFor({ state: 'detached', timeout: 5000 });
      await page.waitForSelector('text=Vehículo 9911XYZ consolidado y vinculado', { timeout: 5000 });

      // Verificar en BD que draft tiene ambos UUIDs, version = 3, mutations registradas y customer_vehicle_roles
      const dbDraftAfterVeh = await pool.query(
        'SELECT customer_id, vehicle_id, version FROM estimate_drafts WHERE id = $1',
        [snapshotDraftId]
      );
      const consolidatedVehId = dbDraftAfterVeh.rows[0]?.vehicle_id;
      const bothConsolidated = !!consolidatedVehId &&
        dbDraftAfterVeh.rows[0].customer_id === consolidatedCustId &&
        dbDraftAfterVeh.rows[0].version === 3;

      const dbMutations = await pool.query(
        'SELECT result_version, idempotency_key FROM estimate_draft_mutations WHERE tenant_id = $1 AND draft_id = $2',
        [ids.tenant, snapshotDraftId]
      );
      const hasMutations = dbMutations.rows.length >= 2;

      const dbRoles = await pool.query(
        'SELECT role, verification_status FROM customer_vehicle_roles WHERE tenant_id = $1 AND customer_id = $2 AND vehicle_id = $3',
        [ids.tenant, consolidatedCustId, consolidatedVehId]
      );
      const hasRole = dbRoles.rows.length === 1 && dbRoles.rows[0].role === 'owner';

      // 6. Ir a /directorio y abrir cliente Marcos García -> verificar presupuesto
      await page.goto('/directorio?tab=clientes');
      await page.waitForSelector('text=Marcos García', { timeout: 10000 });
      await page.locator('text=Marcos García').first().click();
      await page.waitForSelector('text=Historial de Presupuestos', { timeout: 5000 });
      const estInCustomerFicha = await page.locator('text=Sustitución de Embrague Snapshot').isVisible();

      // Cerrar ficha cliente
      const closeCustFicha = page.locator('button[title="Cerrar ficha"]');
      if (await closeCustFicha.isVisible()) await closeCustFicha.click();
      await page.waitForTimeout(200);

      // Abrir vehículo 9911XYZ -> verificar presupuesto
      const vehTab = page.locator('div.inline-flex button:has-text("Vehículos")');
      await vehTab.click();
      await page.waitForSelector('text=9911XYZ', { timeout: 10000 });
      await page.locator('text=9911XYZ').first().click();
      await page.waitForSelector('text=Historial de Presupuestos', { timeout: 5000 });
      const estInVehicleFicha = await page.locator('text=Sustitución de Embrague Snapshot').isVisible();

      // Cerrar ficha vehículo
      const closeVehFicha = page.locator('button[title="Cerrar ficha"]');
      if (await closeVehFicha.isVisible()) await closeVehFicha.click();
      await page.waitForTimeout(200);

      // 7. Reload y volver a comprobar persistencia en ambas fichas
      await page.reload();
      await page.waitForSelector('text=9911XYZ', { timeout: 10000 });
      await page.locator('text=9911XYZ').first().click();
      await page.waitForSelector('text=Historial de Presupuestos', { timeout: 5000 });
      const estInVehReload = await page.locator('text=Sustitución de Embrague Snapshot').isVisible();

      const closeVehReload = page.locator('button[title="Cerrar ficha"]');
      if (await closeVehReload.isVisible()) await closeVehReload.click();
      await page.waitForTimeout(200);

      const clTab = page.locator('div.inline-flex button:has-text("Clientes")');
      await clTab.click();
      await page.waitForSelector('text=Marcos García', { timeout: 10000 });
      await page.locator('text=Marcos García').first().click();
      await page.waitForSelector('text=Historial de Presupuestos', { timeout: 5000 });
      const estInCustReload = await page.locator('text=Sustitución de Embrague Snapshot').isVisible();

      const closeCustReload = page.locator('button[title="Cerrar ficha"]');
      if (await closeCustReload.isVisible()) await closeCustReload.click();
      await page.waitForTimeout(200);

      const step12Passed = initialNulls && custConsolidated && bothConsolidated && hasMutations && hasRole &&
        estInCustomerFicha && estInVehicleFicha && estInVehReload && estInCustReload;

      record(
        'Paso 12: Headless real de Snapshot Consolidation',
        step12Passed,
        `Draft inicial con NULLs -> consolidado cliente (${consolidatedCustId}) y vehículo (${consolidatedVehId}) -> version=3 con mutation receipts -> reflejado bidireccionalmente en Directorio antes y después de reload`
      );
    } catch (err: any) {
      record('Paso 12: Headless real de Snapshot Consolidation', false, undefined, err.message);
    }

    // =========================================================================
    // STEP 13: Responsive móvil 390px (sin desbordamientos, fichas accesibles)
    // =========================================================================
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/directorio');
      await page.waitForSelector('text=Directorio del Taller', { timeout: 10000 });

      const mainScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noMainOverflow = mainScrollWidth <= 390;

      // Open Customer Ficha on mobile
      await page.locator('text=Laura Sánchez').first().click();
      await page.waitForSelector('text=Datos de Contacto', { timeout: 5000 });
      const drawerScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noDrawerOverflow = drawerScrollWidth <= 390;

      // Close drawer
      await page.locator('button[title="Cerrar ficha"]').click();
      await page.waitForTimeout(300);

      // Open new customer modal on mobile
      await page.locator('button:has-text("Nuevo cliente")').click();
      await page.waitForSelector('text=Nuevo Cliente en Taller', { timeout: 5000 });
      const modalScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noModalOverflow = modalScrollWidth <= 390;

      const custModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Cliente en Taller' });
      await custModal.locator('button:has-text("Cancelar")').click();
      await custModal.waitFor({ state: 'detached', timeout: 5000 });

      // Switch to Vehículos on mobile
      const vehiculosTab = page.locator('div.inline-flex button:has-text("Vehículos")');
      await vehiculosTab.click();
      await page.waitForSelector('text=7788BBB', { timeout: 5000 });
      const vehScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noVehOverflow = vehScrollWidth <= 390;

      // Open Vehicle Ficha on mobile
      await page.locator('text=7788BBB').first().click();
      await page.waitForSelector('text=Ficha Técnica y Matrícula', { timeout: 5000 });
      const vehFichaScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const noVehFichaOverflow = vehFichaScrollWidth <= 390;

      const allMobilePass = noMainOverflow && noDrawerOverflow && noModalOverflow && noVehOverflow && noVehFichaOverflow;
      record('Paso 13: Layout responsive móvil 390 px', allMobilePass, `scrollWidth: principal=${mainScrollWidth}px, fichaCliente=${drawerScrollWidth}px, modal=${modalScrollWidth}px, vehículos=${vehScrollWidth}px, fichaVehículo=${vehFichaScrollWidth}px (<= 390px)`);
    } catch (err: any) {
      record('Paso 13: Layout responsive móvil 390 px', false, undefined, err.message);
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
  console.log('🏁 E2E WORKSHOP DIRECTORY EXECUTION SUMMARY');
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
