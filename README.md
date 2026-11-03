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

The start page is titled **Country Guesser** and is a menu with one **card** per game mode. Each card has a picture, the mode's name and a very short description, and opens the mode on its own page. Every mode links back to the menu. Modes that are not ready yet are shown as "Demnächst" and cannot be opened.

| Mode | Page | Description |
|---|---|---|
| Länder benennen | `name-countries.html` | Markiertes Land erkennen und benennen. |
| Länder finden | `find-countries.html` | Genanntes Land auf dem Globus finden. |

Each mode keeps its own progress: recognizing a country and finding it are different skills.

Card pictures are drawn from the real map data by `tools/mode-images.js`.

Behind the menu is a comic-style world map: light blue water with halftone dots and waves, light green land with thick ink outlines and an offset shadow, no country borders. It is drawn from the map data by `tools/menu-background.js` and dimmed in dark mode. The centered title uses the comic font Bangers (stored under `fonts/`) in the map's land green with an ink outline and the land's shadow. There is no subtitle.

---

## Gameplay

This section describes the "Länder benennen" mode. "Länder finden" works the other way round, see [below](#mode-länder-finden).

1. One country on the world map is **highlighted** (clearly marked, e.g. thick outline + pulsing effect).
2. The player **types the country's name** into an input field and confirms with Enter.
3. The game reports **correct** or **wrong**. If wrong, the correct name is shown.
4. The country's progress is updated and saved, and its color on the map changes immediately.
5. After a correct answer the next country appears by itself after 0.4 s, so one press of Enter (or "Prüfen", or "Los" on a phone keyboard) is enough. After a wrong answer or "Weiß ich nicht" the right name stays until the player moves on with Enter, "Weiter" or simply by typing the next answer.

Additionally, a **"Weiß ich nicht"** ("I don't know") button that counts as wrong and reveals the answer.

### Mode "Länder finden"

1. The game **names** a country ("Wo liegt Frankreich?"). Nothing is marked, and the globe stays where the player left it.
2. The player turns and zooms the globe and **clicks or taps** the country.
3. A click on the named country is **correct**; the country is marked where it is, without moving the view. Small countries (under 8,000 km²) also count when the click lands within 11 pixels of them, because they are hard to hit.
4. A click on a **different** country is wrong: the game names the clicked country, marks the right one and turns it to the front.
5. A click on the ocean or on land that is not quizzed is no answer; a hint says so.
6. After a correct answer the next country follows on its own after a short pause (about a second); "Weiter", Enter or a click on the globe skips the pause. After a wrong answer the game waits for "Weiter", Enter or a click (or tap) anywhere on the globe, so the player can see where the country is. Turning or zooming the globe in the meantime does not move on.
7. "Weiß ich nicht" counts as wrong and shows the country.

While a question is open the tooltip names no country at all, because it would give the answer away. Country choice, scoring, colors, stats, legend and settings work as in "Länder benennen".

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
| 1 | 1 point | light red |
| 2–9 | intermediate levels | gradient via orange and yellow (5) to light green |
| 10 | mastered | green |

Rules:
- **First answer for a country**: correct starts at 5, wrong or "I don't know" starts at 3.
- **Later correct answer**: +1 (maximum 10).
- **Later wrong answer** or "I don't know": −1 (minimum 0).
- Once a country has been asked, it never returns to the "never asked" state.

Colors are light and friendly: ten tokens `--score-1` to `--score-10` in `style.css`, with the hue rising from red (0°) over yellow (about 50°) to green (about 125°) and a lightness of at least 40%. `src/colors.js` maps a score to its token. Legend numbers are dark, so they stay readable on the light colors.
Colors must be clearly visible in both light and dark mode. A small **legend** shows the color scale.

---

## Storage (localStorage)

Key: `countryquiz.v1` for "Länder benennen", `countryquiz.find.v1` for "Länder finden", both in the format below.

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

- **Export**: downloads the mode's progress as `countryquiz-progress-YYYY-MM-DD.json` ("Länder finden": `countryquiz-find-progress-YYYY-MM-DD.json`).
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
- **Very small countries** (e.g. Vatican City, Monaco, Malta, Pacific and Caribbean island states) are drawn only as their shapes, with no permanent markers. Entries under 40 km² are enlarged to 40 km² so they can be seen. While one is asked it gets the same outline as every asked country, which is enough to spot it; there is no extra ring.
- Projection: orthographic, so the map looks like a globe seen from space.

---

## Additional UI

- **Stats bar**: number of mastered countries (score 10), started countries (1–9), never-asked countries; overall progress bar.
- **Tooltip**: on hover/tap of a country that has already been asked, show its name and score. For never-asked countries, do not reveal the name.
- **Optional continent filter** (Europe, Asia, Africa, North America, South America, Oceania, Antarctica) that only quizzes countries from that continent. Saved in `settings`.
- **Settings dialog** behind a ⚙ button in the top bar: the continent filter and the progress actions (export, import, reset). They are rarely needed, so they take no space next to the globe.
- **Game screen like a HUD**: the globe takes the whole height below the top bar, and everything else floats over it:
  - the question in a light green comic caption box at the top, in dark blue letters ("Welches Land ist markiert?", or "Wo liegt **Frankreich**?" with the name big); clicks go through it to the globe;
  - the controls in a small rounded dock at the bottom center: the input with "Prüfen"/"Weiter" and "Weiß ich nicht", or in "Länder finden" just "Weiß ich nicht" and "Weiter";
  - the result just above the dock: a comic burst with the verdict ("Richtig!", "Falsch!", "Schade!"), the country and the new score as a badge in its color. Hints, e.g. a click on the ocean, show without burst or score;
  - the legend upright at the right edge, scores 0 to 10 with 10 at the top. Never-asked countries have no swatch: they are plain land.
- **Small screens** (narrow, or phones held sideways): one layout for all devices, only CSS adapts it. The top bar shrinks to one row (menu link, stats as colored dots, ⚙, a thin progress line), the dock spans the width, "Weiß ich nicht" in "Länder benennen" becomes "?", and the legend lies flat above the dock. Even the longest country name fits the caption box.
- **On-screen keyboard**: the page is sized to the area above the keyboard, so the answer row stays visible and the globe takes the rest.
- Keyboard control: the input field automatically gets focus for each new country and stays editable, so a phone keyboard stays open. Enter submits; after a correct answer the next country follows by itself, after a wrong one Enter or typing moves on.
- Supports light and dark mode (`prefers-color-scheme`).
- **Comic look** matching the menu: thick ink outlines and hard offset shadows on panels, buttons, cards and the globe; a comic sunburst behind the globe (rays from the globe's center, halftone dots growing towards the edges, a few comic stars; drawn by `tools/globe-background.js`, with a dark variant); Bangers for titles, buttons, the asked name and the result; the light green of the titles for the main action ("Prüfen", "Weiter"), the highlight around the asked country (with an ink edge, so it shows on the beige land) and focus rings. Buttons press down when clicked and the result pops in, except with reduced motion. Bangers draws ß like a B, so ß comes from the body font. In dark mode interface lines are light, because black lines vanish on dark panels.

---

## Project Structure (suggestion)

```
/
├── index.html          # mode menu
├── name-countries.html # "Länder benennen" mode
├── find-countries.html # "Länder finden" mode
├── style.css
├── images/modes/       # card pictures
├── src/
│   ├── game.js        # shared by all modes: startup, game loop, stats, settings
│   ├── name-countries.js # "Länder benennen": type the name
│   ├── find-countries.js # "Länder finden": click the country
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
- [ ] "Länder finden" names a country without marking it; clicking it is correct, clicking another country is wrong and shows the right one, the ocean is ignored, and names stay hidden until the answer. After the answer a click on the globe moves on, dragging it does not.
- [ ] First answer starts at 5 (correct) or 3 (wrong/"I don't know"); later correct = +1, wrong/"I don't know" = −1; bounds 0 and 10 are respected.
- [ ] Colors match the table above; "never asked" and "score 0" are distinguishable.
- [ ] Progress persists after reloading and after closing the browser.
- [ ] Export produces a JSON file, import restores the same state, invalid files are rejected.
- [ ] Small countries are plain shapes without rings, and the globe turns to the asked country.
- [ ] The globe turns and zooms smoothly, and borders stay sharp at every zoom level.
- [ ] Usable on mobile (touch zoom, input, no horizontal scrollbar), with most of the screen left for the globe even while the keyboard is open.
- [ ] Game works even when localStorage is unavailable (with a notice).