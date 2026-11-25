// Малює UML-діаграми записки з Mermaid у PNG: node scripts/diagrams.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'zapiska', 'fig');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
mkdirSync(OUT, { recursive: true });

const DIAGRAMS = {
  roles: `flowchart LR
  subgraph SYS["Система наземного моніторингу (ARGUS)"]
    direction LR
    DUTY["Черговий оператор<br/>(АРМ чергового зміни)"]
    OBS["Спостерігач"]
    PLAN["Планувальник моніторингу"]
  end
  SRC["Джерела даних<br/>AIS, РЛС, ADS-B, пости"] --> DUTY
  PLAN -- "зони і правила формування подій" --> DUTY
  PLAN -- "зони і правила" --> OBS
  DUTY -- "події і завдання" --> OBS
  OBS -- "донесення і підтвердження" --> DUTY
  DUTY -- "звіт передавання зміни" --> NEXT["Черговий наступної зміни"]`,

  classes: `classDiagram
  direction LR
  class Track {
    +id: string
    +name: string
    +domain: surface | air
    +kind: string
    +classification: friendly | neutral | unknown | suspect
    +lat, lon: number
    +cog, sog: number
    +alt: number
    +sourceId: string
    +ts: datetime
  }
  class Source {
    +id: string
    +name: string
    +type: ais | radar | adsb | visual
    +health: ok | degraded | down
    +lastMessageAt: datetime
  }
  class Zone {
    +id: string
    +name: string
    +kind: restricted | air_restricted | caution | anchorage | patrol
    +rings: polygon
  }
  class Event {
    +id: string
    +type: string
    +priority: critical | high | medium | low
    +status: new | acked | closed
    +title: string
    +ts: datetime
    +ackBy: string
    +comment: string
  }
  class Officer {
    +id: string
    +name: string
    +rank: string
  }
  class HandoverReport {
    +id: string
    +notes: string
    +openEventIds: string[]
    +counts: object
    +createdAt: datetime
    +acceptedAt: datetime
  }
  Source "1" --> "0..*" Track : надає положення
  Track "0..*" -- "0..*" Zone : перебуває в
  Track "1" <-- "0..*" Event : стосується
  Zone "0..1" <-- "0..*" Event : породила
  Officer "1" <-- "0..*" Event : підтвердив
  Officer "1" <-- "0..*" HandoverReport : склав
  HandoverReport "1" o-- "0..*" Event : містить незакриті`,

  structure: `flowchart TD
  L["/login<br/>Вхід чергового"] -- "є звіт на приймання" --> S
  L -- "зміна триває" --> P
  P["/picture<br/>Обстановка: карта, черга подій, джерела"]
  E["/events<br/>Журнал подій"]
  S["/shift<br/>Зміна: приймання / передавання"]
  P <--> E
  P <--> S
  E <--> S
  E -- "вибір події" --> P
  S -- "зміну прийнято" --> P
  S -- "зміну передано" --> X["Вихід із системи"]
  P -- "вихід" --> L`,

  components: `flowchart TB
  subgraph WEB["Вебінтерфейс (браузер, React SPA)"]
    direction TB
    subgraph VIEWS["Представлення"]
      V1["PicturePage"]
      V2["EventsPage"]
      V3["ShiftPage"]
      V4["LoginPage"]
    end
    subgraph COMP["Компоненти"]
      C1["SituationMap"]
      C2["EventQueue"]
      C3["ResolveDialog"]
      C4["TrackCard / SourcesPanel"]
    end
    HOOKS["ui/hooks.js<br/>useNow, useDraft"]
    LIB["lib/events.js, lib/handover.js<br/>чиста логіка"]
    STORE[("store.js<br/>Zustand")]
    API["api.js<br/>REST-клієнт"]
    LINE["line.js<br/>WebSocket-клієнт"]
  end
  subgraph SRV["Тестовий сервер ARGUS (Node.js)"]
    REST["REST API"]
    WS["WebSocket /ws"]
    SIM["World<br/>імітація обстановки і правил"]
  end
  VIEWS --> COMP
  VIEWS --> HOOKS
  VIEWS --> STORE
  COMP --> LIB
  VIEWS --> LIB
  API --> STORE
  LINE --> STORE
  STORE --> API
  API -- "HTTP, Bearer-токен" --> REST
  LINE -- "WebSocket" --> WS
  REST --> SIM
  SIM --> WS`,

  sequence: `sequenceDiagram
  autonumber
  actor О as Черговий
  participant UI as PicturePage
  participant ST as store (Zustand)
  participant API as api.js
  participant LN as line.js
  participant SV as Сервер ARGUS
  О->>UI: відкриває «Обстановка»
  UI->>ST: loadAll()
  ST->>API: tracks(), events(), sources(), zones()
  API->>SV: GET /api/tracks, /events, /sources, /zones
  SV-->>API: знімок обстановки
  API-->>ST: дані → стан «дані»
  UI->>LN: connectLine()
  LN->>SV: WebSocket /ws?token=…
  loop кожні 2 с
    SV-->>LN: track.batch, source.batch
    LN->>ST: applyMessage()
    ST-->>UI: оновлення карти
  end
  SV-->>LN: event.new (критична подія)
  LN->>ST: applyMessage()
  ST-->>UI: подія вгорі черги, лічильники
  О->>UI: обирає подію у черзі
  UI->>UI: центрує карту, відкриває картку цілі
  О->>UI: «Взяти в роботу» + коментар
  UI->>ST: resolveEvent(id, ack, comment)
  ST->>API: POST /api/events/{id}/ack
  API->>SV: коментар обов’язковий для критичної
  SV-->>API: подія (status = acked, ackBy)
  SV-->>LN: event.update (усім клієнтам)
  API-->>ST: оновлена подія
  ST-->>UI: подія переходить у «в роботі»`,

  packages: `flowchart LR
  subgraph ROOT["argus-duty"]
    direction LR
    subgraph SRC["src"]
      direction TB
      VIEWS["views"]
      COMPONENTS["components"]
      UI["ui"]
      LIB["lib"]
      CORE["store.js · api.js · line.js"]
      STORIES["stories"]
    end
    subgraph SERVER["server"]
      direction TB
      APP["app.js"]
      SIM["sim.js"]
      GEO["geo.js · rng.js · seed.js"]
    end
    TEST["test<br/>(Vitest)"]
    LADLE[".ladle"]
    DOCS["docs · scripts"]
  end
  VIEWS --> COMPONENTS
  VIEWS --> UI
  VIEWS --> CORE
  COMPONENTS --> UI
  COMPONENTS --> LIB
  UI --> LIB
  UI --> CORE
  CORE -. "REST, WebSocket" .-> APP
  APP --> SIM
  SIM --> GEO
  STORIES --> COMPONENTS
  LADLE --> STORIES
  TEST -.-> SRC
  TEST -.-> SERVER`,

  eventState: `stateDiagram-v2
  direction LR
  [*] --> new : правило сервера створило подію
  new --> acked : «Взяти в роботу»
  new --> closed : «Закрити»
  acked --> closed : «Закрити»
  closed --> [*]
  note right of new
    Якщо час реагування (SLA) минув —
    подія позначається «Прострочена»
    (обчислюється на клієнті)
  end note`,

  shiftState: `stateDiagram-v2
  direction LR
  [*] --> ЗмінаВедеться : вхід, звіту на приймання немає
  [*] --> ОчікуєПриймання : є звіт попередньої зміни
  ОчікуєПриймання --> ЗмінаВедеться : всі події переглянуто → «Прийняти зміну»
  ЗмінаВедеться --> ОчікуєПриймання : «Передати зміну» (звіт збережено)`,
};

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><div id="host" style="display:inline-block;padding:16px;background:#fff"></div>`;

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } });
await page.setContent(html);
await page.addScriptTag({ content: readFileSync(join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8') });
await page.evaluate(() => {
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Times New Roman, serif',
    themeVariables: { fontSize: '20px', fontFamily: 'Times New Roman, serif' },
    flowchart: { htmlLabels: true, curve: 'basis', padding: 12 },
    sequence: { useMaxWidth: false, mirrorActors: false },
  });
});

for (const [name, code] of Object.entries(DIAGRAMS)) {
  await page.evaluate(async ({ name, code }) => {
    const { svg } = await window.mermaid.render(`d-${name}`, code);
    document.getElementById('host').innerHTML = svg;
    const s = document.querySelector('#host svg');
    const vb = s.viewBox.baseVal;
    s.setAttribute('width', vb.width);
    s.setAttribute('height', vb.height);
    s.style.maxWidth = 'none';
  }, { name, code });
  const host = page.locator('#host svg');
  await host.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('OK', name);
}
await browser.close();
