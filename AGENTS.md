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
npm start
```

Then open http://localhost:8000. This server (`tools/serve.py`) disables browser caching, so changes always show up. To test on a phone, run `python3 -m http.server` and open `http://<computer-ip>:8000` on the same Wi-Fi.

## Testing

New code must not break existing functionality. Run the full suite before every commit, and only hand over a change when it passes:

```sh
npm install        # once
npx playwright install firefox  # once, and after Playwright updates
npm test           # everything
npm run test:unit  # game logic and data, runs in Node
npm run test:e2e   # the game in Firefox, starts its own server
```

GitHub Actions runs `npm test` on every pull request and every push to `main`. A pull request is ready to merge only when those checks are green.

Browser tests use Playwright's own Firefox build, not the installed Firefox. Dev tools are for testing only: the site itself must keep working without `npm install`.

- Every new feature comes with tests for its behavior.
- Every bug fix comes with a test that fails without the fix.
- Logic goes in `tests/unit/`, behavior that needs the page or map goes in `tests/e2e/`.
- Do not weaken, skip or delete an existing test to get a passing run. If a test fails, assume the new code is wrong. Change the test only if the intended behavior changed or the test itself is wrong, and tell the owner.

## Project structure

```
index.html, style.css   page and styles
tools/serve.py          local development server without caching
tools/d3-bundle.js      d3 functions in vendor/d3.bundle.js, rebuilt with `npm run build:vendor`
src/                    one module per responsibility
data/                   map data, country list, aliases
vendor/                 third-party code, never edited by hand
tests/unit/             Node tests for logic and data
tests/e2e/              Playwright tests for the game in a browser
package.json            dev tools only, never shipped to players
.github/workflows/      automated tests on GitHub
LICENSE, README.md      license and specification
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

## Git workflow

### Branches

- `main` always stays working and deployable. Do not commit features or fixes directly to it.
- Create one short-lived branch per change, from an up-to-date `main`.
- Name branches `<type>/<short-kebab-case-description>`, using the commit types below. Examples: `feat/hint-button`, `fix/tooltip-position`, `docs/deployment-guide`.
- Before creating a branch, tell the owner the proposed name and what it will contain.
- When a feature on a feature branch is implemented and passes all tests, commit it without waiting to be asked.
- Only push, merge or deploy when the owner asks.

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

- Run `npm test`, plus linting once it exists.
- Play the affected part of the game in a browser.
- Check the affected items in the README's acceptance criteria.
- Report anything that was not tested.
