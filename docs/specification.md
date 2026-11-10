# Country Guesser – Specification

A simple single-player country guessing game in the browser. Each country on the globe is colored by learning progress, from red (1 point) to green (10 points). Progress is stored locally in the browser and persists across days and months.

This document is the specification for the implementation: it says how the game must behave, and agents keep it in sync with intentional changes. The player-facing description is the [README](../README.md).

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

The start page is titled **Country Guesser** and is a menu with one **card** per game mode. Each card has a picture, the mode's name and a very short description, and opens the mode on its own page. Every mode links back to the menu. A mode that is not ready yet can be shown as "Demnächst" and cannot be opened.

| Mode | Page | Description |
|---|---|---|
| Länder benennen | `name-countries.html` | Markiertes Land erkennen und benennen. |
| Länder finden | `find-countries.html` | Genanntes Land auf dem Globus finden. |
| Hauptstädte lernen | `capitals.html` | Hauptstadt des markierten Landes nennen. |
| Hauptstädte finden | `find-capitals.html` | Land zur genannten Hauptstadt finden. |
| Flaggen erkennen | `flags.html` | Land zur gezeigten Flagge nennen. |

Each mode keeps its own progress: recognizing a country, finding it, knowing its capital, placing a capital and knowing its flag are different skills.

Card pictures are drawn from the real map data by `tools/mode-images.js`.

Behind the menu is a comic-style world map: light blue water with halftone dots and waves, light green land with thick ink outlines and an offset shadow, no country borders. It is drawn from the map data by `tools/menu-background.js` and dimmed in dark mode. The centered title uses the comic font Bangers (stored under `fonts/`) in the map's land green with an ink outline and the land's shadow. There is no subtitle.

---

## Gameplay

This section describes the "Länder benennen" mode. "Länder finden" works the other way round, see [below](#mode-länder-finden); "Hauptstädte lernen" asks for the capital instead of the name, see [below](#mode-hauptstädte-lernen), "Hauptstädte finden" names a capital whose country is to be clicked, see [below](#mode-hauptstädte-finden), and "Flaggen erkennen" shows a flag instead of marking the country, see [below](#mode-flaggen-erkennen).

1. One country on the world map is **highlighted** (clearly marked, e.g. thick outline + pulsing effect).
2. The player **types the country's name** into an input field and confirms with Enter.
3. The game reports **correct** or **wrong**. If wrong, the correct name is shown. The asked country briefly lights up in green when correct, or pulses twice in red when wrong (also for "Weiß ich nicht"); with reduced motion it shows the color for the same time without pulsing.
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

Country choice, scoring, colors, the green or red flash of the asked country, stats, legend and settings work as in "Länder benennen".

### Mode "Hauptstädte lernen"

1. A country is **highlighted** as in "Länder benennen", with the question "Welche Hauptstadt hat das markierte Land?".
2. The player **types the capital** and confirms with Enter. Answer checking works as below, with the capitals of all countries instead of their names: a typo that is just as close to another country's capital does not count (e.g. "Kingston" for Saint Vincent, whose capital is Kingstown). Two places with the same capital (Kingston for Jamaica and Norfolk Island) both accept it.
3. The result always names the country and its capital ("Bolivien: Sucre (auch La Paz)"), right or wrong. Everything else works as in "Länder benennen": the flash, the pause after a right answer, Enter or typing to move on after a wrong one, and "Weiß ich nicht".

Capitals live in `data/capitals.js`, with their German name, the other spellings that count (German, English or local, e.g. "Peking", "Beijing") and, where a country has several official capitals or a separate seat of government, all of them (e.g. Bolivia: Sucre and La Paz; South Africa: Pretoria, Kapstadt and Bloemfontein; Netherlands: Amsterdam and Den Haag). Each of them is a right answer.

Places without any settlement have no capital and are **not asked** in this mode: Antarctica (AQ), Bouvet Island (BV), Heard and McDonald Islands (HM) and the U.S. Minor Outlying Islands (UM). They are left out of its stats and filter counts too. Uninhabited territories with an administrative seat keep it (South Georgia: King Edward Point; French Southern Territories: Port-aux-Français). A mode can pass its own list of countries to `startGame` for this.

### Mode "Hauptstädte finden"

1. The game **names a capital** ("Wo liegt **Canberra**?"), with every official capital where there are several ("Wo liegt **Sucre (auch La Paz)**?"). Nothing is marked, and the globe stays where the player left it.
2. The player **clicks or taps** the country of that capital. Everything else works as in "Länder finden": small countries count within 11 pixels, the ocean is no answer, a wrong click names the clicked country and turns to the right one, "Weiß ich nicht" counts as wrong, and the same pause and ways to move on.
3. The result names the country and its capital ("Australien: Canberra"); after a wrong click or "Weiß ich nicht" it says where the capital is ("Das ist Frankreich. Canberra liegt hier: Australien").
4. Where two places have a capital of the same name, apart from spaces and hyphens, a click on **either** is right, because the question cannot tell them apart: Kingston (Jamaica, Norfolk Island), Basseterre and Basse-Terre (St. Kitts und Nevis, Guadeloupe), Georgetown and George Town (Guyana, Cayman Islands). The asked place gets the point; the clicked one is marked and lights up, and the result names the other one too ("Jamaika: Kingston. Auch richtig: Norfolkinsel"). Kingstown (Saint Vincent) is a different city and does not count for Kingston.

It asks the same countries as "Hauptstädte lernen", without the places that have no capital.

### Mode "Flaggen erkennen"

1. The question box above the globe asks "Welches Land hat diese Flagge?" and shows a **flag** below it, in a 4:3 frame (about 168 px wide on a desktop, about a third of the width on a phone). Nothing is marked, and the globe stays where the player left it, so it gives nothing away.
2. The player **types the country** and confirms with Enter. Answer checking works as in "Länder benennen", with the same names, aliases and tolerance.
3. After the answer the globe **turns to the country** and marks it, so the player learns where it lies. The result names the country ("Richtig! Japan", "Falsch! Das ist Japan"). The pause after a right answer is 1 second; typing the next answer skips it. Everything else works as in "Länder benennen": the flash, Enter or typing to move on after a wrong one, and "Weiß ich nicht".
4. Two pairs of countries have flags that look the same at this size: Indonesia and Monaco, Romania and Chad. For these **either name** is right, and the result names both ("Monaco (gleiche Flagge wie Indonesien)").

Only entries with a **flag of their own** are asked (235 of 250), as listed in `data/flags.js`. Left out are Antarctica (AQ), which has no official flag, and territories that fly the flag of another entry: Bouvet Island and Svalbard (Norway), Heard and McDonald Islands (Australia), the U.S. Minor Outlying Islands (United States), the Caribbean Netherlands (Netherlands), Saint Helena, Ascension and Tristan da Cunha (United Kingdom) and the French Saint-Barthélemy, French Guiana, Guadeloupe, Saint-Martin, Saint-Pierre and Miquelon, Réunion, Wallis and Futuna and Mayotte. They are left out of its stats and filter counts too.

The flags are SVG files in `vendor/flags/`, from flag-icons (see `vendor/NOTICE.md`), copied by `npm run build:flags`. They are loaded from the site itself, so the Content Security Policy stays `img-src 'self' data:`.

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

Key: `countryquiz.v1` for "Länder benennen", `countryquiz.find.v1` for "Länder finden", `countryquiz.capitals.v1` for "Hauptstädte lernen", `countryquiz.capitals-find.v1` for "Hauptstädte finden", `countryquiz.flags.v1` for "Flaggen erkennen", all in the format below.

```json
{
  "version": 1,
  "countries": {
    "AT": { "score": 7, "seen": 12, "correct": 9, "lastSeen": "2026-10-30T21:00:00Z" },
    "FR": { "score": 10, "seen": 15, "correct": 13, "lastSeen": "2026-10-29T18:00:00Z" }
  },
  "settings": { "regions": ["EU", "ME"], "levels": ["easy", "medium"], "filtersOpen": true }
}
```

`settings` is optional throughout: a missing `regions` or `levels` means all of them, an empty list means none. `filtersOpen` remembers whether the filter sidebar is open on a wide screen. An older `"continent": "AF"` is read as `"regions": ["AF"]`.

- Save immediately after **every** answer.
- Wrap all localStorage access in `try/catch`. If localStorage is unavailable (e.g. blocked in private mode), the game still runs and shows a subtle notice that progress is not being saved.
- Validate the format on load. Ignore invalid or unknown entries instead of crashing.
- `version` field for future migrations.

### Export / Import

- **Export**: downloads the mode's progress as `countryquiz-progress-YYYY-MM-DD.json` ("Länder finden": `countryquiz-find-progress-YYYY-MM-DD.json`, "Hauptstädte lernen": `countryquiz-capitals-progress-YYYY-MM-DD.json`, "Hauptstädte finden": `countryquiz-capitals-find-progress-YYYY-MM-DD.json`, "Flaggen erkennen": `countryquiz-flags-progress-YYYY-MM-DD.json`).
- **Import**: select a file, validate its contents, show a confirmation dialog ("Replace current progress?"), then apply.
- **Reset**: deletes all progress after confirmation.

---

## Map

- The world is a **globe** drawn on a **canvas**, projected with **d3-geo** (stored locally under `vendor/`). Canvas draws each frame completely, so borders stay sharp while turning and zooming; SVG only sharpened after zooming stopped.
- **Performance**: a globe has to be projected anew for every frame. To stay fast, only the side facing the player and the visible part are drawn, and borders come from simplified copies per zoom level that stay within half a pixel of the full data, less than a border line is wide. Zooming in never shows less detail than the data has.
- Map data: **Natural Earth, 1:10m scale** (public domain) as GeoJSON or TopoJSON under `data/`. Each country needs a unique **ISO 3166-1 alpha-2 code**.
  - Note: In Natural Earth, the `ISO_A2` field is `-99` for some countries (including France, Norway, Kosovo). Fall back to `ISO_A2_EH` or a manual mapping in those cases.
  - Simplify the file beforehand (e.g. with mapshaper), but keep enough detail that borders stay sharp when zoomed in; target: map data under 3 MB (about 0.8 MB compressed), and limit the maximum zoom to what the data can show sharply.
- **Lakes**: every lake of at least 5,000 km² in Natural Earth's 1:10m lakes (34 lakes, e.g. the Great Lakes, Lake Victoria, Lake Nicaragua, Lake Baikal, Lake Titicaca) is drawn as water over the countries, with a shore line like the coasts. Natural Earth splits some lakes into pieces, e.g. Lake Huron and the North Channel: smaller pieces that adjoin a drawn lake are drawn too, and no line shows between pieces. A click or tap into a lake counts as water, like the ocean, even though the country data covers it, and the green or red flash after an answer leaves lakes blue. The Caspian Sea is water in the country data already. `data/lakes.json` is built by `npm run build:lakes` (see `tools/lakes.js`), which simplifies the shores to within about 1.3 km, still finer than the country borders.
- **Country scope**: all 249 ISO 3166-1 entries plus Kosovo, including dependent territories such as Greenland and French Guiana. Anything else in the map data is drawn but **not asked** and colored neutrally. The list of quizzed countries lives in one central file (`data/countries.js`) so it is easy to adjust.
- **Turn and zoom** the globe: drag to turn it, mouse wheel or pinch to zoom. Turning stops at the poles. After a quick drag the globe keeps turning and slows down within about a second, unless the player prefers reduced motion.
- When a country is asked, the globe **turns it to the front and center** and zooms in moderately, so neighboring land stays in view.
- **Very small countries** (e.g. Vatican City, Monaco, Malta, Pacific and Caribbean island states) are drawn only as their shapes, with no permanent markers. Entries under 40 km² are enlarged to 40 km² so they can be seen. While one is asked it gets the same outline as every asked country, which is enough to spot it; there is no extra ring.
- Projection: orthographic, so the map looks like a globe seen from space.

---

## Additional UI

- **Stats bar**: number of mastered countries (score 10), started countries (1–9), never-asked countries; overall progress bar.
- **No country names on the globe**: hovering, clicking or tapping a country never shows its name or score, in any mode, because that would give answers away.
- **Filter sidebar** on the left of the globe in every mode, opened and closed with a tab ("‹ Filter" / "› Filter") in the middle of its outer edge; closed, the tab waits at the left edge of the screen. Ticks choose which countries are asked; both groups combine, and each mode keeps its own choice in `settings`:
  - **Regions:** Europa, Naher Osten, Asien, Afrika, Nordamerika, Südamerika, Ozeanien, Antarktis. The Middle East is the Arabian Peninsula, the Levant, Iraq, Iran, Egypt and Turkey; Cyprus stays in Europe and the Caucasus in Asia.
  - **Difficulty:** every country has exactly one level. *Einfach*: about 60 very well-known countries. *Schwer*: everything that is not a UN member (territories, dependencies, disputed areas) and UN island states smaller than about 1000 km². *Mittel*: all other UN members. The lists live in `data/countries.js`.
  - Each tick shows how many countries it covers, and the sidebar says how many are asked. A choice without any country says so; then every country comes up until the choice changes.
  - On a wide screen a click on the tab pins the sidebar beside the globe (it starts pinned, or as last left); like the Mac dock, moving the mouse onto the tab or to the left edge of the screen only peeks: the sidebar slides in over the globe and slides out a moment after the mouse leaves it. Running off the left edge of the window keeps it open. On small screens it slides over the globe, starts closed and closes with Escape.
- **Settings dialog** behind a ⚙ button in the top bar: the progress actions (export, import, reset). They are rarely needed, so they take no space next to the globe.
- **Game screen like a HUD**: the globe takes the whole height below the top bar, and everything else floats over it:
  - the question in a light green comic caption box at the top, in dark blue letters ("Welches Land ist markiert?", or "Wo liegt **Frankreich**?" with the name big); clicks go through it to the globe;
  - the controls in a small rounded dock at the bottom center: the input with "Prüfen"/"Weiter" and "Weiß ich nicht", or in "Länder finden" and "Hauptstädte finden" just "Weiß ich nicht" and "Weiter";
  - the result just above the dock: a comic burst with the verdict ("Richtig!", "Falsch!", "Schade!"), the country and the new score as a badge in its color. Hints, e.g. a click on the ocean, show without burst or score;
  - the legend upright at the right edge, scores 0 to 10 with 10 at the top. Never-asked countries have no swatch: they are plain land.
- **Small screens** (narrow, or phones held sideways): one layout for all devices, only CSS adapts it. The top bar shrinks to one row (menu link, stats as colored dots, ⚙, a thin progress line), the dock spans the width, "Weiß ich nicht" in "Länder benennen" becomes "?", and the legend lies flat above the dock. Even the longest country name fits the caption box.
- **On-screen keyboard**: the page is sized to the area above the keyboard, so the answer row stays visible and the globe takes the rest.
- Keyboard control: the input field automatically gets focus for each new country and stays editable, so a phone keyboard stays open. Enter submits; after a correct answer the next country follows by itself, after a wrong one Enter or typing moves on.
- Supports light and dark mode (`prefers-color-scheme`).
- **Comic look** matching the menu: thick ink outlines and hard offset shadows on panels, buttons, cards and the globe; a comic sunburst behind the globe (rays from the globe's center, halftone dots growing towards the edges, a few comic stars; drawn by `tools/globe-background.js`, with a dark variant); Bangers for titles, buttons, the asked name and the result; the light green of the titles for the main action ("Prüfen", "Weiter"), the highlight around the asked country (with an ink edge, so it shows on the beige land) and focus rings. Buttons press down when clicked and the result pops in, except with reduced motion. Bangers draws ß like a B, so ß comes from the body font. In dark mode interface lines are light, because black lines vanish on dark panels.

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

Local testing: because of ES modules, serve via a local web server: `npm start`, then open `http://localhost:8000`. For a phone in the same Wi-Fi, `npm run start:lan` prints the address to open there. Both send `Cache-Control: no-store`, so a reload always shows the current files, and neither serves hidden files. The project structure is in `AGENTS.md`.

---

## Acceptance Criteria

- [ ] Site loads on GitHub Pages without a build step and without console errors.
- [ ] The start page shows a card per mode with picture, name and short description; cards open their mode, and each mode links back to the menu.
- [ ] A country is highlighted, input is checked correctly (including umlauts, alternative names, small typos).
- [ ] After an answer the asked country lights up green once (correct) or pulses red twice (wrong), in every mode.
- [ ] "Länder finden" names a country without marking it; clicking it is correct, clicking another country is wrong and shows the right one, and the ocean is ignored. After the answer a click on the globe moves on, dragging it does not.
- [ ] First answer starts at 5 (correct) or 3 (wrong/"I don't know"); later correct = +1, wrong/"I don't know" = −1; bounds 0 and 10 are respected.
- [ ] Hovering, clicking or tapping a country never shows its name or score, in any mode.
- [ ] Colors match the table above; "never asked" and "score 0" are distinguishable.
- [ ] Progress persists after reloading and after closing the browser.
- [ ] "Hauptstädte lernen" asks the capital of the highlighted country, accepts every official capital, other spellings and small typos, always shows country and capital afterwards, and never asks places without a capital.
- [ ] "Hauptstädte finden" names a capital without marking a country; clicking its country is correct, and where two places share the capital's name either one counts. It never asks places without a capital.
- [ ] "Flaggen erkennen" shows a flag above the globe without marking a country, accepts the country's names with the usual tolerance (and either country for look-alike flags), then turns the globe to the country. It never asks Antarctica or territories that fly another entry's flag.
- [ ] The filter sidebar opens and closes in every mode; region and difficulty ticks combine, only matching countries are asked, and the choice survives a reload.
- [ ] Export produces a JSON file, import restores the same state, invalid files are rejected.
- [ ] Large lakes such as Lake Victoria, Lake Michigan and Lake Nicaragua are water on the globe, and a click into one is no answer.
- [ ] Small countries are plain shapes without rings, and the globe turns to the asked country.
- [ ] The globe turns and zooms smoothly, and borders stay sharp at every zoom level.
- [ ] Usable on mobile (touch zoom, input, no horizontal scrollbar), with most of the screen left for the globe even while the keyboard is open.
- [ ] Game works even when localStorage is unavailable (with a notice).