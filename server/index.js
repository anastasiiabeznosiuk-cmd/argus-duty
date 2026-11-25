// Запуск тестового сервера ARGUS: node server/index.js
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createArgus } from './app.js';
import { World } from './sim.js';

// PORT задає хостинг (Render тощо); локально — ARGUS_PORT або 4000.
const port = Number(process.env.PORT ?? process.env.ARGUS_PORT ?? 4000);
// Якщо вебінтерфейс зібрано (npm run build), сервер роздає і його — тоді сайт і API на одній адресі.
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const staticDir = existsSync(dist) ? dist : null;
const seed = Number(process.env.ARGUS_SEED ?? 7);
const speed = Number(process.env.ARGUS_SPEED ?? 8);

const argus = createArgus({ world: new World({ seed, speed }), staticDir });
argus.start(port).then((p) => {
  console.log(`ARGUS (тестовий сервер) слухає http://localhost:${p}  [зерно=${seed}, прискорення=×${speed}]`);
  if (staticDir) console.log(`Вебінтерфейс роздається з ${staticDir}`);
});
