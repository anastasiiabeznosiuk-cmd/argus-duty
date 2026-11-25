"""Збирання пояснювальної записки: python docs/zapiska/build_zapiska.py  (з кореня проєкту).

Перед запуском: npm run build (розмір пакета), node scripts/diagrams.mjs і node scripts/screens.mjs (рисунки).
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from docx_helpers import Doc  # noqa: E402
from references import REFS  # noqa: E402
import part1, part2, part3  # noqa: E402

FIG = HERE / "fig"
SHOTS = ROOT / "docs" / "screenshots"

TEST_DESC = {
    "test/server/sim.test.js": "імітація обстановки: цілі, події, SLA, зміна",
    "test/server/api.test.js": "REST API, автентифікація, коди помилок, WebSocket",
    "test/lib/events.test.js": "черга, SLA, сортування, фільтри, форматування часу",
    "test/lib/handover.test.js": "формування звіту передавання зміни",
    "test/store.test.js": "сховище стану: оновлення, завантаження, сеанс",
    "test/line.test.js": "канал WebSocket: підключення, перепідключення, застарілість",
    "test/ui/DataState.test.jsx": "чотири стани представлення",
    "test/ui/EventQueue.test.jsx": "черга подій: порядок, прострочення, клавіатура",
    "test/ui/ResolveDialog.test.jsx": "підтвердження події з коментарем",
    "test/views/PicturePage.test.jsx": "«Обстановка»: шари, вибір події, стани",
    "test/views/ShiftPage.test.jsx": "«Зміна»: приймання, передавання, стани",
}


def run_tests():
    report = HERE / "_vitest.json"
    subprocess.run(f'npx vitest run --reporter=json --outputFile="{report}"', cwd=ROOT, shell=True,
                   capture_output=True)
    data = json.loads(report.read_text(encoding="utf8"))
    report.unlink()
    per_file, full = [], []
    for f in data["testResults"]:
        name = f["name"].replace("\\", "/").split("argus-duty/")[1]
        per_file.append((name, len(f["assertionResults"])))
        for a in f["assertionResults"]:
            group = " › ".join(a["ancestorTitles"])
            full.append((name.replace("test/", ""), f"{group}: {a['title']}" if group else a["title"]))
    per_file.sort()
    return data, per_file, sorted(full)


def loc(folder, exts):
    n = 0
    for p in (ROOT / folder).rglob("*"):
        if p.suffix in exts and "node_modules" not in p.parts:
            n += sum(1 for line in p.read_text(encoding="utf8").splitlines() if line.strip())
    return n


def bundle_size():
    assets = ROOT / "dist" / "assets"
    if not assets.exists():
        return "—"
    js = sum(p.stat().st_size for p in assets.glob("*.js"))
    css = sum(p.stat().st_size for p in assets.glob("*.css"))
    return f"JavaScript {js / 1024:.0f} КБ, CSS {css / 1024:.0f} КБ без стиснення".replace(".", ",")


def make_data():
    data, per_file, full = run_tests()
    rows = [["Модуль тестів", "Тестів", "Що перевіряється"]]
    for name, n in per_file:
        rows.append([name.replace("test/", ""), str(n), TEST_DESC.get(name, "")])
    rows.append(["Усього", str(data["numTotalTests"]), ""])
    surface = sum(1 for _ in range(27))
    return {
        "year": 2026, "n_tests": data["numTotalTests"], "n_passed": data["numPassedTests"],
        "n_failed": data["numFailedTests"], "n_reqs": 13, "n_tracks": 37, "n_surface": surface, "n_air": 10,
        "sla_text": "критична — 2 хв, висока — 5 хв, середня — 15 хв, низька — 60 хв",
        "tests_table": rows, "tests_full": [["Файл", "Тест"], *[list(r) for r in full]],
        "loc_src": loc("src", {".js", ".jsx", ".css"}) , "loc_server": loc("server", {".js"}),
        "loc_test": loc("test", {".js", ".jsx"}), "loc_scripts": loc("scripts", {".mjs", ".py"}),
        "bundle": bundle_size(),
    }


def build(D):
    doc = Doc(REFS)
    part1.title_page(doc, D)
    part1.abstract(doc, D)
    part1.toc_and_abbr(doc, D)
    part1.intro(doc, D)
    part1.chapter1(doc, D, FIG)
    part2.chapter2(doc, D, FIG, SHOTS)
    part3.chapter3(doc, D, FIG, SHOTS)
    part3.conclusions(doc, D)
    part3.references(doc)
    part3.appendices(doc, D, ROOT, SHOTS)
    return doc


def main():
    D = make_data()
    D.update(n_figs=0, n_tabs=0, n_refs=0, n_apps=3)
    first = build(D)  # перший прохід лише рахує рисунки, таблиці і джерела
    D.update(n_figs=first.n_figs, n_tabs=first.n_tabs, n_refs=len(first.ref_order))
    doc = build(D)
    out = HERE / "ZAPISKA.docx"
    doc.save(out)
    print(f"Збережено: {out}")
    print(f"Рисунків: {doc.n_figs}, таблиць: {doc.n_tabs}, джерел: {len(doc.ref_order)}, тестів: {D['n_tests']}")
    unused = [k for k in REFS if k not in doc.ref_order]
    if unused:
        print("УВАГА: джерела без посилань у тексті:", ", ".join(unused))


if __name__ == "__main__":
    main()
