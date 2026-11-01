# Country Quiz – World Map Game with Persistent Progress

A simple single-player country guessing game in the browser. Each country on the world map is colored by learning progress, from dark red (guessed correctly once) to dark green (guessed correctly 10 times). Progress is stored locally in the browser and persists across days and months.

This document is the specification for the implementation.

---

## Constraints

- **Purely static website**: HTML, CSS, JavaScript. No backend, no server, no database, no login.
- **Hosting**: GitHub Pages (public repository). The site must work directly from the repo without a build step, or alternatively be built with a simple GitHub Actions workflow. Preferred: **no build step**, vanilla JS with ES modules.
- **No runtime dependencies on external CDNs**: All libraries and map data live locally in the repo (e.g. under `vendor/` and `data/`), so the game does not depend on third-party servers.
- **UI language**: German (country names, buttons, messages). Code, comments and file names in English.
- **License**: MIT (add a `LICENSE` file).
- Works on desktop and mobile (touch, small screens).

---

## Gameplay

1. One country on the world map is **highlighted** (clearly marked, e.g. thick outline + pulsing effect).
2. The player **types the country's name** into an input field and confirms with Enter.
3. The game reports **correct** or **wrong**. If wrong, the correct name is shown.
4. The country's progress is updated and saved, and its color on the map changes immediately.
5. After a short pause (or via a "Weiter" / next button), the next country appears.

Additionally, a **"Weiß ich nicht"** ("I don't know") button that counts as wrong and reveals the answer.

### Choosing the next country

Not purely random, but weighted so weaker countries come up more often:
- Countries with a low score and countries never asked before have a higher probability.
- Countries with score 10 appear rarely, but still occasionally (for review).
- Never the same country twice in a row.

### Answer checking

- Tolerant of case, leading/trailing whitespace and diacritics (e.g. "osterreich" = "Österreich").
- Accept **alternative names** per country (e.g. "USA", "Vereinigte Staaten", "Amerika"; "Großbritannien", "Vereinigtes Königreich", "UK"; "Tschechien", "Tschechische Republik"; "Elfenbeinküste", "Côte d'Ivoire").
- Tolerate small typos (e.g. Levenshtein distance ≤ 1 for short names, ≤ 2 for longer names), but only if the input does not thereby match the name of a **different** country.
- German base names can come from `Intl.DisplayNames(['de'], { type: 'region' })` using ISO 3166-1 alpha-2 codes. Maintain alternative names in a separate file `data/aliases.js`.

---

## Progress Mechanic

Each country has a **score from 0 to 10**, or has **never been asked**.

| State | Meaning | Display |
|---|---|---|
| not present | country never asked | no fill color (neutral light gray/white, outline only) |
| 0 | asked before, currently 0 points | gray (clearly distinguishable from "never asked") |
| 1 | guessed correctly once | dark red |
| 2–9 | intermediate levels | gradient via orange/olive |
| 10 | mastered | dark green |

Rules:
- **Correct answer**: +1 (maximum 10).
- **Wrong answer** or "I don't know": −1 (minimum 0).
- Once a country has been asked, it never returns to the "never asked" state.

Color calculation (guideline, may be visually tuned):
```js
// score 1..10 → hue 0° (red) to 120° (green), dark tones
const hue = ((score - 1) / 9) * 120;
const color = `hsl(${hue}, 70%, 30%)`;
```
Colors must be clearly visible in both light and dark mode. A small **legend** shows the color scale.

---

## Storage (localStorage)

Key: `countryquiz.v1`

```json
{
  "version": 1,
  "countries": {
    "AT": { "score": 7, "seen": 12, "correct": 9, "lastSeen": "2026-10-30T21:00:00Z" },
    "FR": { "score": 10, "seen": 15, "correct": 13, "lastSeen": "2026-10-29T18:00:00Z" }
  },
  "settings": {}
}
```

- Save immediately after **every** answer.
- Wrap all localStorage access in `try/catch`. If localStorage is unavailable (e.g. blocked in private mode), the game still runs and shows a subtle notice that progress is not being saved.
- Validate the format on load. Ignore invalid or unknown entries instead of crashing.
- `version` field for future migrations.

### Export / Import

- **Export**: downloads progress as `countryquiz-progress-YYYY-MM-DD.json`.
- **Import**: select a file, validate its contents, show a confirmation dialog ("Replace current progress?"), then apply.
- **Reset**: deletes all progress after confirmation.

---

## Map

- World map as **SVG**, rendered with **d3-geo** (stored locally under `vendor/`).
- Map data: **Natural Earth, 1:10m scale** (public domain) as GeoJSON or TopoJSON under `data/`. Each country needs a unique **ISO 3166-1 alpha-2 code**.
  - Note: In Natural Earth, the `ISO_A2` field is `-99` for some countries (including France, Norway, Kosovo). Fall back to `ISO_A2_EH` or a manual mapping in those cases.
  - Simplify the file beforehand (e.g. with mapshaper), but keep enough detail that borders stay sharp when zoomed in; target: map data under 3 MB (about 0.8 MB compressed), and limit the maximum zoom to what the data can show sharply.
- **Country scope**: all 249 ISO 3166-1 entries plus Kosovo, including dependent territories such as Greenland and French Guiana. Anything else in the map data is drawn but **not asked** and colored neutrally. The list of quizzed countries lives in one central file (`data/countries.js`) so it is easy to adjust.
- **Zoom and pan** (mouse wheel, drag, pinch on mobile).
- When a country is asked, **automatically zoom to it** so small countries are recognizable.
- **Very small countries** (e.g. Vatican City, Monaco, Malta, Pacific and Caribbean island states) are drawn only as their real shapes, with no permanent markers. Only while one is being asked, an unfilled **ring** shows where it is.
- Projection: an equal-area or compromise projection such as Natural Earth or Equal Earth.

---

## Additional UI

- **Stats bar**: number of mastered countries (score 10), started countries (1–9), never-asked countries; overall progress bar.
- **Tooltip**: on hover/tap of a country that has already been asked, show its name and score. For never-asked countries, do not reveal the name.
- **Optional continent filter** (Europe, Asia, Africa, North America, South America, Oceania, Antarctica) that only quizzes countries from that continent. Saved in `settings`.
- Keyboard control: the input field automatically gets focus for each new country, Enter submits, Enter after the result moves on.
- Supports light and dark mode (`prefers-color-scheme`).

---

## Project Structure (suggestion)

```
/
├── index.html
├── style.css
├── src/
│   ├── main.js        # startup, game loop
│   ├── map.js         # rendering, zoom, coloring
│   ├── storage.js     # load/save/export/import
│   ├── quiz.js        # country selection, answer checking
│   └── colors.js      # score → color
├── data/
│   ├── world.json     # simplified Natural Earth data
│   ├── countries.js   # list of quizzed countries + continent
│   └── aliases.js     # alternative German names
├── vendor/
│   └── d3-geo …       # locally bundled libraries
├── LICENSE            # MIT
└── README.md
```

---

## Security

- No secrets, API keys or tokens in the repo.
- No external scripts at runtime; everything is loaded from the site's own domain.
- Restrictive Content Security Policy via `<meta http-equiv="Content-Security-Policy">`, e.g. `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`.
- Never process imported JSON files via `innerHTML` or `eval`; only accept validated numbers and known country codes.
- Display user input only via `textContent`.

---

## Deployment to GitHub Pages

1. Create a (public) repo on GitHub and push the code.
2. Settings → Pages → Source: branch `main`, folder `/ (root)`.
3. Optional custom domain: enter it under Pages, add a `CNAME` file to the repo, set DNS records at the registrar, enable **"Enforce HTTPS"**.
4. **Verify the domain in your GitHub profile** (profile Settings → Pages → Verified domains) so no one else can use it for GitHub Pages.
5. Enable 2FA on the GitHub account and at the domain registrar, and turn on auto-renewal for the domain.

Local testing: because of ES modules, serve via a local web server, e.g. `python3 -m http.server`, then open `http://localhost:8000`.

---

## Acceptance Criteria

- [ ] Site loads on GitHub Pages without a build step and without console errors.
- [ ] A country is highlighted, input is checked correctly (including umlauts, alternative names, small typos).
- [ ] Correct = +1, wrong/"I don't know" = −1, bounds 0 and 10 are respected.
- [ ] Colors match the table above; "never asked" and "score 0" are distinguishable.
- [ ] Progress persists after reloading and after closing the browser.
- [ ] Export produces a JSON file, import restores the same state, invalid files are rejected.
- [ ] Small countries are plain shapes, get a ring only while asked, and the game zooms to the asked country.
- [ ] Usable on mobile (touch zoom, input, no horizontal scrollbar).
- [ ] Game works even when localStorage is unavailable (with a notice).