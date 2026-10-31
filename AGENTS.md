# Agent Guidelines

Country Quiz is a static browser game built with plain HTML, CSS and JavaScript (ES modules).
`README.md` is the product specification. Read it before changing game behavior, and keep it in sync with intentional changes.

## Non-negotiable constraints

- No build step, backend, login or database. The site must run directly from the repo on GitHub Pages.
- No external requests at runtime. Libraries and data live in the repo.
- Keep the Content Security Policy in `index.html` restrictive.
- Display user input with `textContent` only. Never pass imported data or user input to `innerHTML` or `eval`.
- Never commit secrets, API keys or tokens.
- UI text is German. Code, comments, file names and commit messages are English.
- Use relative paths, because GitHub Pages may serve the site from a subfolder.
- Do not add frameworks, TypeScript, bundlers or CSS frameworks unless the owner asks for them.

## Running locally

ES modules and `fetch` do not work from `file://`, so always use a local server:

```sh
python3 -m http.server --bind 127.0.0.1
```

Then open http://localhost:8000. To test on a phone, omit `--bind` and open `http://<computer-ip>:8000` on the same Wi-Fi.

## Project structure

```
index.html, style.css   page and styles
src/                    one module per responsibility
data/                   map data, country list, aliases
vendor/                 third-party code, never edited by hand
LICENSE, README.md      license and specification
```

Planned as they are added:

```
tests/                  automated tests
tools/                  scripts that generate map data and the d3 bundle
.github/workflows/      automated checks and deployment
.editorconfig           indentation and line endings
package.json            dev tools only, never shipped to players
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

1. Add automated tests for `src/quiz.js` and `src/storage.js` with `node --test`.
2. Add ESLint and Prettier as dev tools. The site must still have no build step.
3. Add a GitHub Actions workflow that runs linting and tests on every push, and tie deployment to those checks.
4. Move the scripts that generate `data/world.json` and `vendor/d3.bundle.js` into `tools/`, so both can be regenerated.
5. Optional: add Playwright tests for the main game flow.

Later, if types become useful, add JSDoc comments checked by TypeScript, which needs no build step.

## Git workflow

### Branches

- `main` always stays working and deployable. Do not commit features or fixes directly to it.
- Create one short-lived branch per change, from an up-to-date `main`.
- Name branches `<type>/<short-kebab-case-description>`, using the commit types below. Examples: `feat/hint-button`, `fix/tooltip-position`, `docs/deployment-guide`.
- Before creating a branch, tell the owner the proposed name and what it will contain.
- Only commit, push, merge or deploy when the owner asks.

### Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary>

<optional body explaining why>
```

| Type | Use for |
|---|---|
| `feat` | a new feature |
| `fix` | a bug fix |
| `docs` | documentation only |
| `style` | formatting with no change in behavior |
| `refactor` | code changes that neither fix a bug nor add a feature |
| `perf` | a performance improvement |
| `test` | adding or changing tests |
| `build` | vendored libraries, generated bundles, dev dependencies |
| `ci` | automated workflows |
| `chore` | maintenance that fits nothing else |

- Common scopes: `quiz`, `map`, `storage`, `ui`, `data`, `vendor`.
- Keep the summary lowercase, imperative, without a trailing period, and under about 72 characters.
- Make each commit one focused, working change. Stage files by name, not with `git add .`.

## Before finishing a change

- Run the game in a browser and check that the console has no errors.
- Check the affected items in the README's acceptance criteria.
- Run tests and linting once they exist.
- Report anything that was not tested.
