import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const provider = process.argv[2];
const audioFile = process.argv[3];
if (provider !== 'vapi' && provider !== 'elevenlabs') throw new Error('provider must be vapi or elevenlabs');
if (!audioFile) throw new Error('audio file is required');
const wavHeader = await readFile(audioFile);
const audioDurationMs = Math.ceil(wavHeader.readUInt32LE(40) / 32) + 10_000;
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${audioFile}`, '--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
try {
  const context = await browser.newContext({ permissions: ['microphone'], baseURL: 'http://127.0.0.1:3131' });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`/?provider=${provider}`);
  await page.getByRole('button', { name: 'Start' }).click();
  let connectionError: string | undefined;
  try {
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('connected:'), undefined, { timeout: 30_000 });
  } catch (error) {
    connectionError = error instanceof Error ? error.message : String(error);
  }
  const status = await page.locator('#status').textContent();
  await page.waitForTimeout(audioDurationMs);
  if (!connectionError) await page.getByRole('button', { name: 'Stop' }).click();
  process.stdout.write(`${JSON.stringify({ provider, status, connectionError, consoleErrors, pageErrors, events: await page.locator('#events').textContent() })}\n`);
} finally {
  await browser.close();
}
