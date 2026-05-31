# Portfolio Image Generator

Skrypt TypeScript, który dla podanego adresu publicznej strony:

1. Robi **3 screenshoty** (Playwright): desktop, tablet, mobile  
2. Składa je w **mockup** na podstawie szablonu (domyślnie `template_01.jpg`)

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

Opcje:

- `-t, --template` — ID szablonu (domyślnie `template_01`)
- `-o, --output` — katalog na pośrednie PNG

Wynik:

- `output/<domena>/screenshots/` — `desktop.png`, `tablet.png`, `mobile.png`
- `output/<domena>/template_01.png` — gotowy mockup

## Kalibracja nowego szablonu

```bash
npm run calibrate
```

Wykrywa obszary szachownicy w `template_01.jpg`. Skopiuj współrzędne do `src/templates/<nazwa>.ts` i zarejestruj w `src/templates/index.ts`.

## Mapowanie screenów

| Screenshot | Urządzenia w szablonie |
|------------|-------------------------|
| Desktop    | monitor + laptop        |
| Tablet     | tablet                  |
| Mobile     | smartphone              |
