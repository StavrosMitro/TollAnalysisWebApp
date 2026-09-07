#!/usr/bin/env node
/**
 * Visual smoke check against a RUNNING stack.
 *
 *   docker compose up --build -d          # from the repo root
 *   cd front-end && npm run visual-check   # needs a Chromium at $CHROMIUM_PATH
 *
 * For every page x viewport it:
 *   - loads the page (demo-logs-in first for authenticated pages)
 *   - screenshots to ./.visual/ (gitignored)
 *   - flags horizontal overflow, console errors and failed requests
 * Exits non-zero if any page has an overflow or a console error.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_URL || 'http://localhost:9115';
const CHROMIUM = process.env.CHROMIUM_PATH || '/snap/bin/chromium';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.visual');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const PAGES = [
  { path: '/', name: 'landing', auth: false },
  { path: '/login', name: 'login', auth: false },
  { path: '/overview', name: 'overview', auth: true },
  { path: '/map', name: 'map', auth: true },
  { path: '/analytics', name: 'analytics', auth: true },
  { path: '/forecast', name: 'forecast', auth: true },
  { path: '/debts', name: 'debts', auth: true },
  { path: '/project', name: 'project', auth: true },
];

// Fail early with a clear message if the stack is not up.
try {
  const res = await fetch(BASE + '/healthz');
  if (!res.ok) throw new Error(`healthz -> ${res.status}`);
} catch (e) {
  console.error(
    `\nCannot reach the app at ${BASE} (${e.message}).\n` +
      `Start the stack first, from the repo root:\n` +
      `  docker compose up -d        # (add --build the first time)\n` +
      `then re-run:  cd front-end && npm run visual-check\n`
  );
  process.exit(2);
}

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

let demoToken;
try {
  const seed = await browser.newPage();
  await seed.goto(BASE, { waitUntil: 'domcontentloaded' });
  demoToken = await seed.evaluate(async (base) => {
    const r = await fetch(base + '/api/auth/demo-login', { method: 'POST' });
    return (await r.json()).token;
  }, BASE);
  await seed.close();
} catch (e) {
  await browser.close();
  console.error('demo-login failed:', e.message);
  process.exit(1);
}
if (!demoToken) { await browser.close(); console.error('demo-login returned no token'); process.exit(1); }

const report = [];
for (const vp of VIEWPORTS) {
  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    const errors = [];
    const failed = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 180)));
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 180)));
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (!/google|gstatic|favicon|analytics\./.test(u)) failed.push(`${r.failure().errorText} ${u.slice(0, 90)}`);
    });
    if (p.auth) {
      // Only the top document — never a sandboxed child frame (e.g. the pyvis
      // graph iframe on /debts), where touching localStorage throws.
      await page.evaluateOnNewDocument((t) => {
        if (window === window.top) {
          try { localStorage.setItem('token', t); } catch (e) { /* sandboxed */ }
        }
      }, demoToken);
    }
    try {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle2', timeout: 20000 });
    } catch (e) {
      errors.push('NAV: ' + e.message.slice(0, 120));
    }
    await new Promise((r) => setTimeout(r, p.name === 'map' ? 2500 : 1000));
    const m = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      cliW: document.documentElement.clientWidth,
    }));
    const overflow = m.docW - m.cliW > 1 ? m.docW - m.cliW : 0;
    await page.screenshot({ path: path.join(OUT, `${vp.name}-${p.name}.png`) });
    report.push({ viewport: vp.name, page: p.name, overflow, errors, failed });
    await page.close();
  }
}
await browser.close();

let bad = 0;
console.log('\n=== visual check ===');
for (const r of report) {
  const flags = [];
  if (r.overflow) flags.push(`OVERFLOW +${r.overflow}px`);
  if (r.errors.length) flags.push(`${r.errors.length} console err`);
  if (r.failed.length) flags.push(`${r.failed.length} failed req`);
  if (flags.length) bad++;
  console.log(`${r.viewport.padEnd(8)} ${r.page.padEnd(10)} ${flags.length ? 'FAIL ' + flags.join(', ') : 'ok'}`);
}
const errs = [...new Set(report.flatMap((r) => r.errors))];
if (errs.length) { console.log('\nconsole errors:'); errs.forEach((e) => console.log('  - ' + e)); }
console.log(`\nscreenshots: ${OUT}`);
process.exit(bad ? 1 : 0);
