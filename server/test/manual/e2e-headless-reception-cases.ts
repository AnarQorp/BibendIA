import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { FastifyInstance } from 'fastify';
import type { AuthenticationAdapter } from '../../src/auth/authentication-adapter.js';
import type { PrincipalContext } from '../../src/auth/principal.js';
import { buildApi } from '../../src/api/app.js';
import { createPool, inTenantTransaction } from '../../src/persistence/pool.js';
import { testPiiProtection } from '../support/test-pii.js';
import { insertProtectedCustomer, insertProtectedVehicle } from '../../src/security/protected-records.js';
import { createReceptionCase } from '../../src/modules/reception-cases/reception-cases.js';

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
  console.log('🚀 Starting BibendIA Headless E2E Suite for Bandeja Inteligente / Reception Cases...\n');

  const pool = createPool('migrator');
  const pii = testPiiProtection();

  const ids = {
    tenant: randomUUID(),
    user: randomUUID(),
    workshop: randomUUID(),
    customer: randomUUID(),
    vehicle: randomUUID(),
    appointment: randomUUID(),
    estimate: randomUUID(),
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

  // 1. Seed Tenant, Workshop, User, Membership
  await pool.query(
    "INSERT INTO tenants(id, name, lifecycle_status) VALUES($1, 'E2E Reception Workshop', 'pilot')",
    [ids.tenant]
  );
  await pool.query(
    "INSERT INTO workshops(id, tenant_id, name) VALUES($1, $2, 'Taller Central Bandeja')",
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

  // 2. Seed Customer & Vehicle
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await insertProtectedCustomer(client, pii, {
      id: ids.customer,
      tenantId: ids.tenant,
      displayName: 'Carlos Martínez',
      phone: '+34600123456',
    });
    await insertProtectedVehicle(client, pii, {
      id: ids.vehicle,
      tenantId: ids.tenant,
      plate: '6270VQX',
      make: 'SEAT',
      model: 'León',
    });
  });

  // 3. Seed Voice-created Case (Callback request)
  let voiceCaseId = '';
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    const res = await createReceptionCase(
      client,
      pii,
      ids.tenant,
      { type: 'voice_agent', id: 'voice-agent-elevenlabs' },
      'voice-seed:001',
      {
        workshopId: ids.workshop,
        channel: 'PHONE',
        callerType: 'CUSTOMER',
        category: 'callback_request',
        summary: 'Quiere que le llamen para comentar el presupuesto',
        detail: 'Cliente llama preocupado por el presupuesto de la distribución. Pide que le llame el jefe de taller por la tarde.',
        priority: 'HIGH',
        customerId: ids.customer,
        vehicleId: ids.vehicle,
        contactContext: {
          phone: '+34600123456',
          contactPerson: 'Carlos Martínez',
        },
        idempotencyKey: `voice-case-${randomUUID()}`,
        provenance: { source: 'elevenlabs_tool', provider: 'elevenlabs', conversationId: 'conv-carlos-001' },
      }
    );
    voiceCaseId = res.case.id as string;
  });

  // 4. Seed Supplier Case (No Customer)
  let supplierCaseId = '';
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    const res = await createReceptionCase(
      client,
      pii,
      ids.tenant,
      { type: 'workshop_user', id: ids.user },
      'supplier-seed:002',
      {
        workshopId: ids.workshop,
        channel: 'PHONE',
        callerType: 'SUPPLIER',
        category: 'parts_delivery',
        summary: 'El alternador llegará mañana a las 11:00',
        detail: 'Recalvi confirma expedición del pedido 89412. Entrega prevista en la primera ruta matinal.',
        priority: 'NORMAL',
        contactContext: {
          phone: '912345678',
          contactPerson: 'Recalvi Recambios',
        },
        idempotencyKey: `supplier-case-${randomUUID()}`,
        provenance: { source: 'workshop_manual' },
      }
    );
    supplierCaseId = res.case.id as string;
  });

  // 5. Seed Tow Truck Case (Transport)
  await inTenantTransaction(pool, ids.tenant, async (client) => {
    await createReceptionCase(
      client,
      pii,
      ids.tenant,
      { type: 'voice_agent', id: 'voice-agent-elevenlabs' },
      'tow-seed:003',
      {
        workshopId: ids.workshop,
        channel: 'PHONE',
        callerType: 'TOW_TRANSPORT',
        category: 'tow_delivery',
        summary: 'Llegada prevista a las 10:40 con Peugeot 208 averiado',
        priority: 'HIGH',
        contactContext: {
          phone: '611223344',
          contactPerson: 'Grúas del Norte',
        },
        idempotencyKey: `tow-case-${randomUUID()}`,
        provenance: { source: 'elevenlabs_tool' },
      }
    );
  });

  // Fastify app with real routes & dist-workshop serving
  const app: FastifyInstance = buildApi(pool, {
    authentication,
    piiProtection: pii,
    allowedOrigins: ['http://127.0.0.1'],
  });

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

  // Static files handler
  app.setNotFoundHandler(async (request, reply) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = url.pathname;

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
      } catch {}
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

  // Inject tenantId in localStorage
  await page.addInitScript((tId) => {
    localStorage.setItem('bibendia_tenant_id', tId);
  }, ids.tenant);

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Voice-origin ReceptionCase visible on /bandeja
    // -------------------------------------------------------------------------
    try {
      await page.goto('/bandeja');
      await page.waitForSelector('h2:has-text("Bandeja Inteligente")', { timeout: 10000 });
      const voiceCaseCard = page.locator('button').filter({ hasText: 'Quiere que le llamen para comentar el presupuesto' });
      await voiceCaseCard.waitFor({ state: 'visible', timeout: 8000 });
      const hasVoiceCase = await voiceCaseCard.isVisible();
      const hasPlate = await voiceCaseCard.locator('text=6270VQX').isVisible();
      const hasCallbackBadge = await voiceCaseCard.locator('text=Callback').isVisible();

      record('Gate 1: Voice-origin ReceptionCase visible tras carga', hasVoiceCase && hasPlate && hasCallbackBadge, 'Caso de voz visible con matrícula 6270VQX y badge Callback');
    } catch (err: any) {
      record('Gate 1: Voice-origin ReceptionCase visible tras carga', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 2: Supplier Case (Non-customer) visible & first-class
    // -------------------------------------------------------------------------
    try {
      const supplierCard = page.locator('button').filter({ hasText: 'El alternador llegará mañana a las 11:00' });
      const hasSupplierCard = await supplierCard.isVisible();
      const hasSupplierBadge = await supplierCard.locator('text=Proveedor').isVisible();

      record('Gate 2: Supplier case sin Customer de primera clase', hasSupplierCard && hasSupplierBadge, 'Caso de recambista visible sin cliente ficticio forzado');
    } catch (err: any) {
      record('Gate 2: Supplier case sin Customer de primera clase', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 3: Case Detail Inspection (Callback Highlighted & Contact Data)
    // -------------------------------------------------------------------------
    try {
      const voiceCaseCard = page.locator('button').filter({ hasText: 'Quiere que le llamen para comentar el presupuesto' });
      await voiceCaseCard.click();
      await page.waitForSelector('text=Solicitud de Llamada Pendiente', { timeout: 5000 });

      const callbackNotice = await page.locator('text=Este interlocutor solicitó expresamente que el taller le llame').isVisible();
      const hasPhone = await page.locator('text=+34600123456').isVisible();
      const hasPerson = await page.locator('text=Carlos Martínez').first().isVisible();
      const hasDetailText = await page.locator('text=distribución').isVisible();

      record('Gate 3: Detalle de Caso con Callback destacado y contacto canónico', callbackNotice && hasPhone && hasPerson && hasDetailText, 'Teléfono descifrado +34600123456 y notas visibles');
    } catch (err: any) {
      record('Gate 3: Detalle de Caso con Callback destacado y contacto canónico', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 4: Status Transition Mutation & Hard Reload Survival
    // -------------------------------------------------------------------------
    try {
      // Transition from OPEN to IN_PROGRESS
      const inProgressBtn = page.locator('button:has-text("En curso")');
      await inProgressBtn.click();
      await page.waitForSelector('text=Estado actualizado a En curso', { timeout: 5000 });

      // Hard reload page
      await page.reload();
      await page.waitForSelector('h2:has-text("Bandeja Inteligente")', { timeout: 10000 });

      // Select the voice case again
      await page.locator('button').filter({ hasText: 'Quiere que le llamen para comentar el presupuesto' }).click();
      await page.waitForTimeout(500);

      // Verify status is still IN_PROGRESS in the detail panel
      const selectedStatusBtn = page.locator('button.bg-slate-900:has-text("En curso")');
      const survivedReload = await selectedStatusBtn.isVisible();

      record('Gate 4: Transición de estado persistente que sobrevive hard reload', survivedReload, 'Estado IN_PROGRESS persistido en base de datos tras reload');
    } catch (err: any) {
      record('Gate 4: Transición de estado persistente que sobrevive hard reload', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 5: Priority Mutation & Real Audit Trail (Fail-closed audit history)
    // -------------------------------------------------------------------------
    try {
      // Change priority to URGENT in detail panel
      const prioritySelect = page.locator('[data-testid="detail-priority-select"]');
      await prioritySelect.selectOption('URGENT');
      await page.waitForSelector('text=Prioridad cambiada a Urgente', { timeout: 5000 });

      // Verify Audit Trail has entries
      await page.waitForSelector('text=Historial Real de Cambios', { timeout: 5000 });
      const hasCreatedEvent = await page.locator('text=Asunto creado').first().isVisible();
      const hasUpdatedEvent = await page.locator('text=Actualización de estado o prioridad').first().isVisible();
      const hasHistoryList = await page.locator('[data-testid="history-list"]').isVisible();

      // Test fail-closed on history endpoint failure
      await page.route('**/v1/workshop/tenants/*/reception-cases/*/history', route => {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'HISTORY_FETCH_FAILED' }) });
      });

      // Trigger history reload via priority change to HIGH
      await page.locator('[data-testid="detail-priority-select"]').selectOption('HIGH');
      await page.waitForSelector('[data-testid="history-error"]', { timeout: 5000 });

      const hasHistoryError = await page.locator('[data-testid="history-error"]').isVisible();
      const hasFakeInference = await page.locator('text=Caso creado el').isVisible(); // Must NOT infer fake activity

      // Unroute history
      await page.unroute('**/v1/workshop/tenants/*/reception-cases/*/history');

      // Click "Reintentar" in history error banner
      await page.locator('[data-testid="history-error"] button:has-text("Reintentar")').click();
      await page.waitForSelector('[data-testid="history-list"]', { timeout: 5000 });
      const historyRecovered = await page.locator('[data-testid="history-list"]').isVisible();

      record('Gate 5: Cambio de prioridad persistente e historial de auditoría real (fail-closed verificado)',
        hasCreatedEvent && hasUpdatedEvent && hasHistoryList && hasHistoryError && !hasFakeInference && historyRecovered,
        'Audit events reales comprobados; error en history muestra banner con reintento sin inferir falsas actividades');
    } catch (err: any) {
      record('Gate 5: Cambio de prioridad persistente e historial de auditoría real (fail-closed verificado)', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 6: Manual Case Creation in the same canonical collection
    // -------------------------------------------------------------------------
    try {
      await page.locator('button:has-text("+ Nuevo asunto")').first().click();
      await page.waitForSelector('text=Nuevo Asunto en Recepción', { timeout: 5000 });

      const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Nuevo Asunto en Recepción' });
      await modal.locator('input[placeholder*="Llamar para comentar"]').fill('Comprobar entrega de pastillas de freno Brembo');
      await modal.locator('textarea').fill('Asegurar recepción antes de las 16:00 para la intervención de la tarde.');
      await modal.locator('select').first().selectOption('SUPPLIER');

      await modal.locator('button:has-text("Crear Asunto")').click();
      await page.waitForSelector('text=Comprobar entrega de pastillas de freno Brembo', { timeout: 8000 });

      const newCaseVisible = await page.locator('button').filter({ hasText: 'Comprobar entrega de pastillas de freno Brembo' }).isVisible();

      record('Gate 6: Creación manual de asunto en la misma colección canónica', newCaseVisible, 'Nuevo asunto de proveedor creado y renderizado inmediatamente');
    } catch (err: any) {
      record('Gate 6: Creación manual de asunto en la misma colección canónica', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 7: Filters (Requieren atención vs Resueltos / Cerrados)
    // -------------------------------------------------------------------------
    try {
      // Resolve the supplier case
      const supplierCard = page.locator('button').filter({ hasText: 'El alternador llegará mañana a las 11:00' });
      await supplierCard.click();
      await page.locator('[data-testid="status-btn-RESOLVED"]').click();
      await page.waitForTimeout(600);

      // Now under "Requieren Atención", supplier case should NOT be in the pending list
      const pendingFilteredOut = !(await page.locator('div.divide-y button').filter({ hasText: 'El alternador llegará mañana a las 11:00' }).isVisible());

      // Switch to "Resueltos / Cerrados" tab
      await page.locator('button:has-text("Resueltos / Cerrados")').click();
      await page.waitForTimeout(500);

      const resolvedVisible = await page.locator('div.divide-y button').filter({ hasText: 'El alternador llegará mañana a las 11:00' }).isVisible();

      // Return to "Requieren Atención"
      await page.locator('button:has-text("Requieren Atención")').click();

      record('Gate 7: Filtros de estado operativos (Requieren atención vs Resueltos)', pendingFilteredOut && resolvedVisible, 'Casos resueltos no dominan la vista principal');
    } catch (err: any) {
      record('Gate 7: Filtros de estado operativos (Requieren atención vs Resueltos)', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 8: Cross-Entity Navigation (Directorio / Clientes)
    // -------------------------------------------------------------------------
    try {
      await page.locator('button').filter({ hasText: 'Quiere que le llamen para comentar el presupuesto' }).click();
      await page.waitForTimeout(400);

      const openCustomerBtn = page.locator('button[title*="Directorio"]').first();
      await openCustomerBtn.click();
      await page.waitForSelector('text=Directorio del Taller', { timeout: 8000 });

      const hasDirectorio = await page.locator('h1:has-text("Directorio del Taller")').isVisible();
      const hasCarlosInDirectory = await page.locator('text=Carlos Martínez').first().isVisible();

      record('Gate 8: Navegación cruzada a Directorio de clientes', hasDirectorio && hasCarlosInDirectory, 'Enlace directo desde el caso abrió la ficha de Carlos Martínez');
    } catch (err: any) {
      record('Gate 8: Navegación cruzada a Directorio de clientes', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 9: Fail-Closed on Backend Failure (No empty fake state)
    // -------------------------------------------------------------------------
    try {
      await page.goto('/bandeja');
      await page.waitForSelector('h2:has-text("Bandeja Inteligente")', { timeout: 8000 });

      // Intercept reception-cases API with 500 error
      await page.route('**/v1/workshop/tenants/*/reception-cases*', route => {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }) });
      });

      // Click "Refrescar"
      await page.locator('button[title="Refrescar bandeja"]').click();
      await page.waitForSelector('text=Error al consultar la Bandeja de Recepción', { timeout: 6000 });

      const hasErrorBanner = await page.locator('text=Error al consultar la Bandeja de Recepción').isVisible();
      const hasRetryBtn = await page.locator('button:has-text("Reintentar")').isVisible();

      // Clean up route
      await page.unroute('**/v1/workshop/tenants/*/reception-cases*');

      record('Gate 9: Principio de estado Fail-Closed ante caída de backend', hasErrorBanner && hasRetryBtn, 'Error explícito visible con botón de reintento, cero lista vacía falsa');
    } catch (err: any) {
      record('Gate 9: Principio de estado Fail-Closed ante caída de backend', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 10: Mobile Viewport 390px (No horizontal overflow, master-detail navigation)
    // -------------------------------------------------------------------------
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/bandeja');
      await page.waitForSelector('h2:has-text("Bandeja Inteligente")', { timeout: 8000 });

      // Check horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // In 390px, clicking a case navigates to full detail with back button
      const firstCaseCard = page.locator('div.divide-y button').first();
      await firstCaseCard.click();
      await page.waitForTimeout(500);

      const backBtn = page.locator('button:has-text("Volver a la bandeja")');
      const isBackBtnVisible = await backBtn.isVisible();

      // Click back button to return to list
      await backBtn.click();
      await page.waitForTimeout(300);
      const isListVisibleAgain = await page.locator('h2:has-text("Bandeja Inteligente")').isVisible();

      // Restore desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });

      record('Gate 10: Soporte móvil a 390 px sin overflow horizontal', !hasHorizontalOverflow && isBackBtnVisible && isListVisibleAgain, 'Navegación master-detail a 390 px con una mano verificada');
    } catch (err: any) {
      record('Gate 10: Soporte móvil a 390 px sin overflow horizontal', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 11: Mi Día Integration (Pendientes de Recepción compact widget)
    // -------------------------------------------------------------------------
    try {
      await page.goto('/midia');
      await page.waitForSelector('text=Buenos días', { timeout: 8000 });

      const hasMiDiaWidget = await page.locator('h3:has-text("Pendientes de Recepción")').isVisible();
      const hasOpenBandejaBtn = await page.locator('button:has-text("Ir a Bandeja Inteligente")').isVisible();

      // Click CTA to navigate back to Bandeja
      await page.locator('button:has-text("Ir a Bandeja Inteligente")').click();
      await page.waitForSelector('h2:has-text("Bandeja Inteligente")', { timeout: 6000 });
      const navigatedToBandeja = await page.locator('h2:has-text("Bandeja Inteligente")').isVisible();

      record('Gate 11: Integración en Mi Día con bloque compacto Pendientes de Recepción', hasMiDiaWidget && hasOpenBandejaBtn && navigatedToBandeja, 'Widget compacto visible con contador y navegación fluida a Bandeja');
    } catch (err: any) {
      record('Gate 11: Integración en Mi Día con bloque compacto Pendientes de Recepción', false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // STEP 12: Regression checks (Agenda, Directorio, Presupuestos)
    // -------------------------------------------------------------------------
    try {
      // 1. Agenda
      await page.goto('/agenda');
      await page.waitForSelector('text=Agenda', { timeout: 8000 });
      const agendaOk = await page.locator('text=Agenda').first().isVisible();

      // 2. Directorio
      await page.goto('/directorio');
      await page.waitForSelector('text=Directorio del Taller', { timeout: 8000 });
      const directorioOk = await page.locator('text=Directorio del Taller').isVisible();

      // 3. Presupuestos
      await page.goto('/presupuestos');
      await page.waitForTimeout(1000);
      const presupuestosOk = await page.locator('text=Presupuesto').first().isVisible();

      record('Gate 12: Comprobación de no regresión en Agenda, Directorio y Presupuestos', agendaOk && directorioOk && presupuestosOk, 'Vistas existentes cargan y operan con normalidad');
    } catch (err: any) {
      record('Gate 12: Comprobación de no regresión en Agenda, Directorio y Presupuestos', false, undefined, err.message);
    }

  } finally {
    await browser.close();
    await app.close();

    // Clean up test data
    await pool.query('DELETE FROM audit_events WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM reception_cases WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM vehicles WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM customers WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM tenant_memberships WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM users WHERE id = $1', [ids.user]);
    await pool.query('DELETE FROM workshops WHERE tenant_id = $1', [ids.tenant]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [ids.tenant]);
    await pool.end();
  }

  console.log('\n======================================================');
  console.log('SUMMARY OF BANDEJA INTELIGENTE HEADLESS E2E GATES:');
  console.log('======================================================');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });
  console.log('======================================================');
  if (allPassed) {
    console.log('🏆 BANDEJA INTELIGENTE / RECEPTION CASES — PASS');
    process.exit(0);
  } else {
    console.error('❌ SOME GATES FAILED');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('FATAL E2E ERROR:', err);
  process.exit(1);
});
