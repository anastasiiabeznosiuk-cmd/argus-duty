"""Бібліографічні описи (ДСТУ ГОСТ 7.1). Номер у переліку визначається порядком першої згадки в тексті.

Дати звернення до електронних ресурсів слухач проставляє сам після перегляду джерел.
"""
ACCESS = "(дата звернення: __.__.2026)"

REFS = {
    "imo": "Resolution A.1158(32). Guidelines for Vessel Traffic Services. London : International Maritime Organization, 2021.",
    "itu": "Recommendation ITU-R M.1371-5. Technical characteristics for an automatic identification system using "
           "time division multiple access in the VHF maritime mobile frequency band. Geneva : ITU, 2014.",
    "iala": f"IALA VTS Manual. Saint-Germain-en-Laye : International Association of Marine Aids to Navigation and "
            f"Lighthouse Authorities. URL: https://www.iala.int {ACCESS}.",
    "isa": "ANSI/ISA-18.2-2016. Management of Alarm Systems for the Process Industries. Research Triangle Park : "
           "International Society of Automation, 2016.",
    "eemua": "EEMUA Publication 191. Alarm systems: a guide to design, management and procurement. London : "
             "The Engineering Equipment and Materials Users Association, 2013.",
    "iso11064": "ISO 11064-1:2000. Ergonomic design of control centres. Part 1: Principles for the design of control "
                "centres. Geneva : International Organization for Standardization, 2000.",
    "mt": f"MarineTraffic: Global Ship Tracking Intelligence. URL: https://www.marinetraffic.com {ACCESS}.",
    "fr24": f"Flightradar24: Live Flight Tracker. URL: https://www.flightradar24.com {ACCESS}.",
    "dstu": "ДСТУ 3008:2015. Інформація та документація. Звіти у сфері науки і техніки. Структура та правила "
            "оформлювання. Київ : ДП «УкрНДНЦ», 2016.",
    "iso9241": "ISO 9241-210:2019. Ergonomics of human-system interaction. Part 210: Human-centred design for "
               "interactive systems. Geneva : International Organization for Standardization, 2019.",
    "wcag": f"Web Content Accessibility Guidelines (WCAG) 2.2. W3C Recommendation. URL: https://www.w3.org/TR/WCAG22/ {ACCESS}.",
    "carbon": f"Carbon Design System. IBM. URL: https://carbondesignsystem.com {ACCESS}.",
    "m3": f"Material Design 3. Google. URL: https://m3.material.io {ACCESS}.",
    "fluent": f"Fluent 2 Design System. Microsoft. URL: https://fluent2.microsoft.design {ACCESS}.",
    "antd": f"Ant Design. URL: https://ant.design {ACCESS}.",
    "react": f"React: документація. URL: https://react.dev {ACCESS}.",
    "vite": f"Vite: документація. URL: https://vite.dev {ACCESS}.",
    "zustand": f"Zustand: документація. URL: https://zustand.docs.pmnd.rs {ACCESS}.",
    "router": f"React Router: документація. URL: https://reactrouter.com {ACCESS}.",
    "maplibre": f"MapLibre GL JS: документація. URL: https://maplibre.org/maplibre-gl-js/docs/ {ACCESS}.",
    "osm": f"OpenStreetMap. Tile Usage Policy. URL: https://operations.osmfoundation.org/policies/tiles/ {ACCESS}.",
    "ladle": f"Ladle: документація. URL: https://ladle.dev {ACCESS}.",
    "vitest": f"Vitest: документація. URL: https://vitest.dev {ACCESS}.",
    "rtl": f"Testing Library: документація. URL: https://testing-library.com {ACCESS}.",
    "eslint": f"ESLint: документація. URL: https://eslint.org {ACCESS}.",
    "rfc6455": "RFC 6455. The WebSocket Protocol. Internet Engineering Task Force, 2011.",
    "ws": f"ws: a Node.js WebSocket library. URL: https://github.com/websockets/ws {ACCESS}.",
    "mermaid": f"Mermaid: документація. URL: https://mermaid.js.org {ACCESS}.",
    "playwright": f"Playwright: документація. URL: https://playwright.dev {ACCESS}.",
    "oidc": "OpenID Connect Core 1.0. OpenID Foundation, 2014.",
}
