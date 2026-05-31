# Portfolio Image Generator

Skrypt TypeScript, który dla podanego adresu publicznej strony:

1. Robi **3 screenshoty** (Playwright): desktop, tablet, mobile — **tylko jeśli jeszcze nie istnieją**
2. Składa mockupy dla **każdego szablonu** w `src/templates/` (automatycznie)

## Wymagania

- Node.js 20+
- Przeglądarka Chromium (instalowana przy pierwszym uruchomieniu)

```bash
npm install
npx playwright install chromium
```

## Użycie

```bash
npm run generate -- https://example.com
```

Opcja `-s, --screenshots` — własny katalog na screenshoty.

Wynik:

- `output/<domena>/screenshots/` — `desktop.png`, `tablet.png`, `mobile.png`
- `output/<domena>/template_01.png` — (i kolejne szablony, gdy dodasz)

Ponowne uruchomienie dla tej samej strony **nie robi screenshotów od nowa** — tylko przebudowuje mockupy.

Tylko składanie (bez Playwright):

```bash
npm run recomposite -- y.co
```

## Nowy szablon

1. Dodaj `src/templates/template_02.jpg` + `template_02.ts` (export konfiguracji z polem `id`)
2. Uruchom `npm run generate` — powstanie też `output/.../template_02.png`

Kalibracja współrzędnych: `npm run calibrate`

## Mapowanie screenów

| Screenshot | Urządzenia w szablonie |
|------------|-------------------------|
| Desktop    | monitor + laptop        |
| Tablet     | tablet                  |
| Mobile     | smartphone              |

Screeny są przycinane maską pikseli; ramki urządzeń są na wierzchu.
