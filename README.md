# ABAP Viewer

Moderný a rýchly prehliadač SAP ABAP objektov exportovaných do formátu JSON. Aplikácia umožňuje offline prehliadanie kódu, definícií tabuliek a štruktúr bez potreby pripojenia k SAP systému.

![ABAP Viewer](app-icon.svg)

## 🚀 Funkcie

- **Stromová štruktúra**: Prehľadné zobrazenie objektov zoskupených podľa systému, paketu a typu (Programy, Tabuľky, Funkčné skupiny, Triedy, Transformácie).
- **Full-text vyhľadávanie**: Okamžité vyhľadávanie v názvoch, popisoch aj samotnom zdrojovom kóde pomocou SQLite FTS5.
- **Zvýrazňovanie syntaxe**: Podpora pre ABAP a SQL syntax s tmavým motívom (VS Code style).
- **Import zo ZIP**: Jednoduché nahranie hromadného exportu objektov vo formáte ZIP.
- **Detailné zobrazenie**:
  - **Programy**: Zdrojový kód s číslovaním riadkov.
  - **Tabuľky**: Prehľadná definícia polí, kľúčov, typov a dĺžok.
  - **Funkčné moduly**: Zobrazenie parametrov (Import, Export, Changing, Tables) a zdrojového kódu.
  - **Triedy**: Oddelené zobrazenie definície a implementácie.
- **Navigácia**: História navigácie (tlačidlo Späť) a možnosť prejsť na objekt dvojklikom na jeho názov v kóde.
- **Multi-platformovosť**: Beží ako webová aplikácia alebo ako natívna desktopová aplikácia (Tauri).

## 🛠 Technológie

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Ikony**: Lucide React
- **Syntax Highlighting**: React Syntax Highlighter (Prism)
- **Backend (Web)**: Node.js, Express, Better-SQLite3
- **Backend (Desktop)**: Rust, Tauri, Rusqlite
- **Databáza**: SQLite (lokálna súborová databáza `abap_viewer.db`)

## 📦 Inštalácia a spustenie

### Webová verzia (Vývoj)

1. Nainštalujte závislosti:
   ```bash
   npm install
   ```
2. Spustite vývojový server:
   ```bash
   npm run dev
   ```
3. Otvorte prehliadač na `http://localhost:3000`.

### Desktopová verzia (Tauri)

Pre zostavenie desktopovej aplikácie musíte mať nainštalovaný [Rust](https://www.rust-lang.org/).

1. Spustite Tauri v debug režime:
   ```bash
   npm run tauri dev
   ```
2. Zostavte produkčnú verziu (.exe, .app, .deb):
   ```bash
   npm run tauri build
   ```

## 📂 Formát dát pre import

Aplikácia očakáva ZIP súbor obsahujúci JSON súbory pre jednotlivé objekty. Každý JSON by mal mať nasledovnú štruktúru:

```json
{
  "system": "DEV",
  "package": "Z_MY_PACKAGE",
  "objectType": "PROG",
  "name": "Z_MY_PROGRAM",
  "description": "Popis programu",
  "source": "REPORT z_my_program.\n\nWRITE 'Hello World'.",
  "subObjects": []
}
```

## 📄 Licencia

Tento projekt je šírený pod licenciou MIT.
