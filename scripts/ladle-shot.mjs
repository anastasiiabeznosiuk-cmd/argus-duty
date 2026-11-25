// Знімок каталогу компонентів (Ladle): потрібна збірка `npm run stories:build`.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'build');
const OUT = join(ROOT, 'docs', 'screenshots');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = createServer((req, res) => {
  const p = req.url.split('?')[0];
  const path = join(BUILD, p === '/' ? 'index.html' : decodeURIComponent(p));
  if (!existsSync(path)) return (res.writeHead(404), res.end());
  res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(61000);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 300)));
await page.goto('http://localhost:61000/');
await page.waitForTimeout(1500);
await page.getByText('Черга подій', { exact: true }).first().click();
await page.getByText('Late events', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(1500);
const links = await page.locator('a').allTextContents();
console.log(links.join(' | '));
await page.screenshot({ path: join(OUT, 'ladle.png') });
await browser.close();
srv.close();
