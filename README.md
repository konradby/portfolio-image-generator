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

1. Dodaj `src/templates/template_XX.png` (lub `.jpg`)
2. Opcjonalnie `template_XX.ts` z współrzędnymi — bez pliku `.ts` konfiguracja zostanie wykryta automatycznie
3. `npm run generate` — powstanie `output/.../template_XX.png`

Kalibracja: `npm run calibrate:any -- src/templates/template_02.png`

**template_02** — 3 urządzenia (monitor, tablet, telefon), bez laptopa.

## Mapowanie screenów

| Screenshot | Urządzenia w szablonie |
|------------|-------------------------|
| Desktop    | monitor + laptop        |
| Tablet     | tablet                  |
| Mobile     | smartphone              |

Screeny są przycinane maską pikseli; ramki urządzeń są na wierzchu.
