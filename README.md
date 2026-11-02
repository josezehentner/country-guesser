# Country Quiz – World Map Game with Persistent Progress

A simple single-player country guessing game in the browser. Each country on the world map is colored by learning progress, from dark red (1 point) to dark green (10 points). Progress is stored locally in the browser and persists across days and months.

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

## Mode Menu

The start page is a menu with one **card** per game mode. Each card has a picture, the mode's name and a very short description, and opens the mode on its own page. Every mode links back to the menu. Modes that are not ready yet are shown as "Demnächst" and cannot be opened.

| Mode | Page | Description |
|---|---|---|
| Länder benennen | `name-countries.html` | Markiertes Land erkennen und benennen. |

Card pictures are drawn from the real map data by `tools/mode-images.js`.

---

## Gameplay

This section describes the "Länder benennen" mode.


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
| 1 | 1 point | dark red |
| 2–9 | intermediate levels | gradient via orange/olive |
| 10 | mastered | dark green |

Rules:
- **First answer for a country**: correct starts at 5, wrong or "I don't know" starts at 3.
- **Later correct answer**: +1 (maximum 10).
- **Later wrong answer** or "I don't know": −1 (minimum 0).
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

- The world is a **globe** drawn on a **canvas**, projected with **d3-geo** (stored locally under `vendor/`). Canvas draws each frame completely, so borders stay sharp while turning and zooming; SVG only sharpened after zooming stopped.
- **Performance**: a globe has to be projected anew for every frame. To stay fast, only the side facing the player and the visible part are drawn, and borders come from simplified copies per zoom level that stay within half a pixel of the full data, less than a border line is wide. Zooming in never shows less detail than the data has.
- Map data: **Natural Earth, 1:10m scale** (public domain) as GeoJSON or TopoJSON under `data/`. Each country needs a unique **ISO 3166-1 alpha-2 code**.
  - Note: In Natural Earth, the `ISO_A2` field is `-99` for some countries (including France, Norway, Kosovo). Fall back to `ISO_A2_EH` or a manual mapping in those cases.
  - Simplify the file beforehand (e.g. with mapshaper), but keep enough detail that borders stay sharp when zoomed in; target: map data under 3 MB (about 0.8 MB compressed), and limit the maximum zoom to what the data can show sharply.
- **Country scope**: all 249 ISO 3166-1 entries plus Kosovo, including dependent territories such as Greenland and French Guiana. Anything else in the map data is drawn but **not asked** and colored neutrally. The list of quizzed countries lives in one central file (`data/countries.js`) so it is easy to adjust.
- **Turn and zoom** the globe: drag to turn it, mouse wheel or pinch to zoom. Turning stops at the poles. After a quick drag the globe keeps turning and slows down within about a second, unless the player prefers reduced motion.
- When a country is asked, the globe **turns it to the front and center** and zooms in moderately, so neighboring land stays in view.
- **Very small countries** (e.g. Vatican City, Monaco, Malta, Pacific and Caribbean island states) are drawn only as their shapes, with no permanent markers. Entries under 40 km² are enlarged to 40 km² so they can be seen. Only while one is being asked, an unfilled **ring** shows where it is.
- Projection: orthographic, so the map looks like a globe seen from space.

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
├── index.html          # mode menu
├── name-countries.html # "Länder benennen" mode
├── style.css
├── images/modes/       # card pictures
├── src/
│   ├── main.js        # startup, game loop
│   ├── map.js         # globe rendering, turning, zoom, coloring
│   ├── simplify.js    # border detail per zoom level
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
- [ ] The start page shows a card per mode with picture, name and short description; cards open their mode, and each mode links back to the menu.
- [ ] A country is highlighted, input is checked correctly (including umlauts, alternative names, small typos).
- [ ] First answer starts at 5 (correct) or 3 (wrong/"I don't know"); later correct = +1, wrong/"I don't know" = −1; bounds 0 and 10 are respected.
- [ ] Colors match the table above; "never asked" and "score 0" are distinguishable.
- [ ] Progress persists after reloading and after closing the browser.
- [ ] Export produces a JSON file, import restores the same state, invalid files are rejected.
- [ ] Small countries are plain shapes, get a ring only while asked, and the globe turns to the asked country.
- [ ] The globe turns and zooms smoothly, and borders stay sharp at every zoom level.
- [ ] Usable on mobile (touch zoom, input, no horizontal scrollbar).
- [ ] Game works even when localStorage is unavailable (with a notice).