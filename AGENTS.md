# Agent Guidelines

Country Guesser is a static browser game built with plain HTML, CSS and JavaScript (ES modules).
`docs/specification.md` is the product specification. Read it before changing game behavior, and keep it in sync with intentional changes.
`README.md` describes the game for players. Update it when a change is visible to them, e.g. a new mode or control.

The owner's general rules for every project (git workflow, Conventional Commits, pull requests, testing) are in their personal `~/.claude/CLAUDE.md`. This file only adds what is specific to this project.

## Non-negotiable constraints

- No build step, backend, login or database. The site must run directly from the repo on GitHub Pages.
- No external requests at runtime. Libraries and data live in the repo.
- Keep the Content Security Policy in every HTML page restrictive.
- Display user input with `textContent` only. Never pass imported data or user input to `innerHTML` or `eval`.
- UI text is German. Code, comments, file names and commit messages are English.
- Use relative paths, because GitHub Pages may serve the site from a subfolder.
- Do not add frameworks, TypeScript, bundlers or CSS frameworks unless the owner asks for them.

## Running locally

ES modules and `fetch` do not work from `file://`, so always use a local server:

```sh
npm start
```

Then open http://localhost:8000. This server (`tools/serve.py`) disables browser caching, so changes always show up. To run a second one at the same time, e.g. in another worktree, pick another port: `PORT=8001 npm start`. To test on a phone, run `npm run start:lan` instead and open the address it prints on a phone in the same Wi-Fi; it caches nothing either. Only then is the server reachable from other devices. It never serves hidden files such as `.git` or `.claude`.

## Testing

```sh
npm install        # once
npx playwright install firefox  # once, and after Playwright updates
npm test           # everything
npm run test:unit  # game logic and data, runs in Node
npm run test:e2e   # the game in Firefox, starts its own server
```

GitHub Actions runs `npm test` on every pull request and every push to `main`. A pull request is ready to merge only when those checks are green.

Browser tests use Playwright's own Firefox build, not the installed Firefox. Dev tools are for testing only: the site itself must keep working without `npm install`.

The browser tests start their own server on a port derived from the folder, so test runs in different worktrees never meet. If that port is taken, the run fails instead of testing someone else's code; set `TEST_PORT` to use another one.

Logic goes in `tests/unit/`, behavior that needs the page or map goes in `tests/e2e/`.

## Project structure

```
index.html              mode menu with one card per game mode
name-countries.html     the "Länder benennen" mode
find-countries.html     the "Länder finden" mode
capitals.html           the "Hauptstädte lernen" mode
find-capitals.html      the "Hauptstädte finden" mode
style.css               styles for all pages
images/                 menu background and card pictures, generated with `npm run build:images`
fonts/                  web fonts with their licenses
tools/serve.py          local development server without caching
tools/d3-bundle.js      d3 functions in vendor/d3.bundle.js, rebuilt with `npm run build:vendor`
tools/mode-images.js    draws the card pictures from the map data
tools/menu-background.js draws the comic world map behind the menu
tools/globe-background.js draws the comic sunburst behind the globe
tools/lakes.js          builds data/lakes.json from Natural Earth, with `npm run build:lakes`
src/                    one module per responsibility
data/                   map data, lakes, country list, aliases
vendor/                 third-party code, never edited by hand
tests/unit/             Node tests for logic and data
tests/e2e/              Playwright tests for the game in a browser
package.json            dev tools only, never shipped to players
.github/workflows/      automated tests on GitHub
docs/specification.md   product specification
README.md               description of the game for players
LICENSE                 license
```

Planned as they are added:

```
tools/                  script that generates map data
.editorconfig           indentation and line endings
eslint.config.js        linter rules
```

Add structure only when it is needed. Once `src/` gets crowded, organize it by feature.

## Code principles

- Keep logic separate from the page so it can be tested without a browser. `src/quiz.js` must stay free of DOM and map code.
- The list of quizzed countries lives only in `data/countries.js`.
- Use semantic HTML and CSS variables for colors and spacing. Support light and dark mode.
- Keep keyboard use, labels and color contrast working.
- Wrap all `localStorage` access in `try/catch`, and validate anything loaded or imported.
- Record third-party code, data sources and changes to them in `vendor/NOTICE.md`.

## Engineering roadmap

Not done yet. Work through these in order when asked:

1. Add ESLint and Prettier as dev tools. The site must still have no build step.
2. Add linting to the GitHub Actions workflow, and tie deployment to its checks.
3. Move the script that generates `data/world.json` into `tools/`, so it can be regenerated. The d3 bundle already can be.

Later, if types become useful, add JSDoc comments checked by TypeScript, which needs no build step.

## Git in this project

- Common commit scopes: `quiz`, `map`, `storage`, `ui`, `data`, `vendor`.
- Run `npm install` once in a new worktree.
- The shared files that cause most conflicts here are `style.css`, `src/game.js`, `src/map.js`, `docs/specification.md`, `README.md` and `tests/e2e/game.spec.js`.

## Before finishing a change

- Run `npm test`, plus linting once it exists.
- Play the affected part of the game in a browser.
- Check the affected items in the specification's acceptance criteria.
