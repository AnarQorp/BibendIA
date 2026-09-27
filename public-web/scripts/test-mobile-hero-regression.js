import { spawn } from 'child_process';
import http from 'http';

async function getCDPTargetUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const pageTarget = list.find(t => t.type === 'page' && t.url.includes('5174')) || list.find(t => t.type === 'page');
          if (pageTarget && pageTarget.webSocketDebuggerUrl) {
            resolve(pageTarget.webSocketDebuggerUrl);
          } else {
            reject(new Error('No active page CDP target found for port 5174'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        } else if (data.method && this.eventListeners.has(data.method)) {
          this.eventListeners.get(data.method)(data.params);
        }
      };
    });
  }

  on(method, handler) {
    this.eventListeners.set(method, handler);
  }

  async send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluateFunction(fn) {
    const expr = '(' + fn.toString() + ')()';
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'JS Evaluation Exception');
    }
    return res.result.value;
  }

  close() {
    this.ws.close();
  }
}

async function runTestScenario(width, height, isMobile) {
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    'http://localhost:5174'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  let targetUrl;
  try {
    targetUrl = await getCDPTargetUrl();
  } catch (err) {
    chrome.kill();
    throw new Error(`Failed to locate CDP target: ` + err.message);
  }

  const client = new CDPClient(targetUrl);
  await client.connect();

  return new Promise((resolve, reject) => {
    let reloadFired = false;

    client.on('Page.loadEventFired', async () => {
      if (reloadFired) return;
      reloadFired = true;

      // Small delay for DOM layout stabilization
      await new Promise(r => setTimeout(r, 600));

      try {
        const evalResult = await client.evaluateFunction(() => {
          const logo = document.querySelector('img[alt="BibendIA Logo Mascot"]');
          // Robust selector for the badge element (div.inline-flex containing Reception text)
          const badge = Array.from(document.querySelectorAll('div.inline-flex')).find(e => e.textContent.includes('Recepción inteligente'));
          const title = document.querySelector('h1');

          const logoRect = logo ? logo.getBoundingClientRect() : null;
          const badgeRect = badge ? badge.getBoundingClientRect() : null;
          const titleRect = title ? title.getBoundingClientRect() : null;

          const scrollWidth = document.documentElement.scrollWidth;
          const clientWidth = document.documentElement.clientWidth;
          const innerWidth = window.innerWidth;
          const overflowPx = Math.max(0, scrollWidth - clientWidth);

          return {
            innerWidth,
            clientWidth,
            scrollWidth,
            overflowPx,
            logo: logoRect ? { top: logoRect.top, left: logoRect.left, width: logoRect.width, height: logoRect.height, visible: logoRect.width > 0 && logoRect.height > 0 } : null,
            badge: badgeRect ? { top: badgeRect.top, left: badgeRect.left, visible: badgeRect.width > 0 && badgeRect.height > 0 } : null,
            title: titleRect ? { top: titleRect.top, left: titleRect.left, visible: titleRect.width > 0 } : null
          };
        });

        client.close();
        chrome.kill();
        resolve(evalResult);
      } catch (err) {
        client.close();
        chrome.kill();
        reject(err);
      }
    });

    // Enable Page events and apply Emulation Metrics
    (async () => {
      await client.send('Page.enable');
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: isMobile ? 2 : 1,
        mobile: isMobile
      });
      await client.send('Page.reload');
    })().catch(err => {
      client.close();
      chrome.kill();
      reject(err);
    });
  });
}

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log(' BIBENDIA PUBLIC-WEB AUTOMATED HERO REGRESSION & OVERFLOW SUITE');
  console.log(' (task_raqel_bibendia_prod_mobile_hero_logo_20260927_005)');
  console.log('===============================================================\n');

  let overallPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: Mobile Viewport (390x844) CDP Emulation & Assertions
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Mobile Viewport (390x844) CDP Emulation & Assertions:');
  try {
    const mobileData = await runTestScenario(390, 844, true);

    console.log(`  > Measured Viewport & Document: innerWidth=${mobileData.innerWidth}, clientWidth=${mobileData.clientWidth}, scrollWidth=${mobileData.scrollWidth}`);
    console.log(`  > Measured Horizontal Overflow: ${mobileData.overflowPx}px`);

    if (mobileData.innerWidth === 390 && mobileData.clientWidth === 390 && mobileData.scrollWidth === 390 && mobileData.overflowPx === 0) {
      console.log('  [PASS] Mobile Dimensions & Overflow: innerWidth === clientWidth === scrollWidth === 390 (0px overflow).');
    } else {
      console.error(`  [FAIL] Mobile dimensions mismatch or overflow detected: innerWidth=${mobileData.innerWidth}, clientWidth=${mobileData.clientWidth}, scrollWidth=${mobileData.scrollWidth}`);
      overallPassed = false;
    }

    if (!mobileData.logo || !mobileData.badge || !mobileData.title) {
      console.error('  [FAIL] Missing required DOM elements (logo, badge, or title) on mobile layout.');
      overallPassed = false;
    } else {
      const logoTop = mobileData.logo.top;
      const badgeTop = mobileData.badge.top;
      const titleTop = mobileData.title.top;

      console.log(`  > Element Vertical Offsets: LogoTop=${logoTop.toFixed(1)}px, BadgeTop=${badgeTop.toFixed(1)}px, TitleTop=${titleTop.toFixed(1)}px`);

      if (mobileData.logo.visible && logoTop < badgeTop && badgeTop < titleTop) {
        console.log(`  [PASS] Element Vertical Order Asserted: LogoTop (${logoTop.toFixed(1)}px) < BadgeTop (${badgeTop.toFixed(1)}px) < TitleTop (${titleTop.toFixed(1)}px). Logo is positioned FIRST in Hero!`);
      } else {
        console.error(`  [FAIL] Vertical order assertion failed! Expected logoTop < badgeTop < titleTop, got: ${logoTop} < ${badgeTop} < ${titleTop}`);
        overallPassed = false;
      }
    }
  } catch (e) {
    console.error('  [FAIL] Test 1 threw exception:', e.message);
    overallPassed = false;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Desktop Viewport (1280x800) Layout Regression Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Desktop Viewport (1280x800) Production Layout Check:');
  try {
    const desktopData = await runTestScenario(1280, 800, false);

    console.log(`  > Measured Viewport & Document: innerWidth=${desktopData.innerWidth}, clientWidth=${desktopData.clientWidth}, scrollWidth=${desktopData.scrollWidth}`);
    console.log(`  > Measured Horizontal Overflow: ${desktopData.overflowPx}px`);

    if (desktopData.overflowPx === 0) {
      console.log('  [PASS] Desktop Horizontal Overflow: 0px.');
    } else {
      console.error(`  [FAIL] Desktop horizontal overflow detected: ${desktopData.overflowPx}px.`);
      overallPassed = false;
    }
  } catch (e) {
    console.error('  [FAIL] Test 2 threw exception:', e.message);
    overallPassed = false;
  }

  console.log('\n===============================================================');
  if (overallPassed) {
    console.log(' SUMMARY: ALL REGRESSION TESTS PASSED (0 ERRORS)');
    console.log('===============================================================');
    process.exit(0);
  } else {
    console.error(' SUMMARY: REGRESSION SUITE FAILED');
    console.log('===============================================================');
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
