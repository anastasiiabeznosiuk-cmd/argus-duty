// Знімки екрана для записки: node scripts/screens.mjs
// Потрібні запущені сервер (порт 4000) зі свіжим станом і Vite (порт 5173).
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://localhost:5173';
mkdirSync(OUT, { recursive: true });

const shot = async (page, name, opts = {}) => {
  await page.screenshot({ path: join(OUT, `${name}.png`), ...opts });
  console.log('OK', name);
};
const chaos = (mode) => fetch('http://localhost:4000/api/_chaos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
const mapReady = (page) => page.waitForSelector('[data-testid=situation-map][data-ready=true]', { timeout: 15000 }).then(() => page.waitForTimeout(4500));

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'uk-UA' });
const page = await ctx.newPage();

// ---- вхід
await page.goto(`${APP}/login`);
await page.waitForSelector('select');
await shot(page, 'login');
await page.selectOption('select', { label: 'капітан Мельник Т. В. (Берег-2)' });
await page.click('button[type=submit]');

// ---- приймання зміни
await page.waitForURL('**/shift');
await page.waitForSelector('text=Приймання зміни');
await shot(page, 'shift-accept', { fullPage: true });
for (const box of await page.locator('.review input[type=checkbox]').all()) await box.evaluate((el) => el.click());
await page.getByRole('button', { name: 'Прийняти зміну' }).click();
await page.waitForURL('**/picture');

// ---- обстановка (дані)
await page.goto(`${APP}/picture?capture`);
await mapReady(page);
await shot(page, 'picture');
await page.locator('.queue__item').first().click();
await page.waitForTimeout(2500);
await shot(page, 'picture-selected');
await page.getByRole('button', { name: 'Взяти в роботу' }).first().click();
await page.waitForSelector('#resolve-comment');
await shot(page, 'dialog-ack');
await page.fill('#resolve-comment', 'Ціль виявлено РЛС-1, екіпаж попереджено.');
await page.getByRole('dialog').getByRole('button', { name: 'Взяти в роботу' }).click().catch(() => {});
await page.waitForTimeout(800);

// ---- журнал
await page.goto(`${APP}/events`);
await page.waitForSelector('table');
await shot(page, 'journal');
await page.selectOption('#f-priority', 'critical');
await page.waitForTimeout(300);
await shot(page, 'journal-filter');
await page.fill('#f-q', 'такої події немає');
await page.waitForTimeout(300);
await shot(page, 'journal-empty');

// ---- передавання зміни
await page.goto(`${APP}/shift`);
await page.waitForSelector('text=Передавання зміни');
await shot(page, 'shift-handover', { fullPage: true });

// ---- стани представлення «Обстановка»
await chaos('slow');
await page.goto(`${APP}/picture`);
await page.waitForTimeout(900);
await shot(page, 'state-loading');
await chaos('error');
await page.goto(`${APP}/picture`);
await page.waitForSelector('[data-testid=state-error]', { timeout: 10000 });
await page.waitForTimeout(500);
await shot(page, 'state-error');
await chaos('off');

const session = await page.evaluate(() => sessionStorage.getItem('argus.session'));
const empty = await ctx.newPage();
await empty.addInitScript((v) => sessionStorage.setItem('argus.session', v), session);
await empty.route('**/api/tracks', (r) => r.fulfill({ json: { tracks: [] } }));
await empty.route('**/api/events', (r) => r.fulfill({ json: { events: [] } }));
await empty.goto(`${APP}/picture`);
await empty.waitForSelector('[data-testid=state-empty]');
await empty.waitForTimeout(500);
await shot(empty, 'state-empty');
await empty.close();

// ---- вузький екран 375 px
const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: 'uk-UA', isMobile: true, hasTouch: true });
const mp = await mobile.newPage();
await mp.goto(`${APP}/login`);
await mp.waitForSelector('select');
await mp.selectOption('select', { label: 'капітан Мельник Т. В. (Берег-2)' });
await mp.click('button[type=submit]');
await mp.waitForURL('**/picture');
await mp.goto(`${APP}/picture?capture`);
await mapReady(mp);
await shot(mp, 'mobile-picture');
await mp.evaluate(() => window.scrollTo(0, 520));
await mp.waitForTimeout(400);
await shot(mp, 'mobile-queue');
await mobile.close();

// ---- каталог компонентів Ladle (статична збірка)
const BUILD = join(ROOT, 'build');
if (existsSync(BUILD)) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json' };
  const srv = createServer((req, res) => {
    const path = join(BUILD, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!existsSync(path)) return (res.writeHead(404), res.end());
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  }).listen(61000);
  const lp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await lp.goto('http://localhost:61000/?story=chyerha-podiy--data'.replace('chyerha-podiy', 'cherha-podiy'));
  await lp.waitForTimeout(2500);
  await shot(lp, 'ladle');
  await lp.goto('http://localhost:61000/?story=datastate--loading');
  await lp.waitForTimeout(1500);
  await srv.close();
}

await browser.close();
