// The language of the page: German or English. src/language-boot.js picks it before
// the page is drawn and sets it as <html lang>. In Node, e.g. in the unit tests,
// there is no page and the language is German.
export const LANGUAGES = ['de', 'en'];
export const LANGUAGE_KEY = 'countryquiz.language';

const pageLanguage = typeof document === 'undefined' ? 'de' : document.documentElement.lang;

export const LANG = LANGUAGES.includes(pageLanguage) ? pageLanguage : 'de';

// Keeps the choice for every page and reloads this one in the new language. A
// running question is lost, the progress is not.
export function chooseLanguage(language) {
  if (!LANGUAGES.includes(language) || language === LANG) return;
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Without storage the choice cannot outlast the reload: nothing to do.
    return;
  }
  window.location.reload();
}
