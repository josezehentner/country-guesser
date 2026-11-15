// Picks the language of the page before anything is drawn, so an English page never
// shows its German text first. A classic script in the <head> of every page: it
// must run before the body, which modules never do.
//
// The language is the one chosen with the switch, or else the first German or
// English one the browser prefers, or else English. An English page stays hidden
// until src/page-text.js has translated it, or at most for a moment if that fails.
(function () {
  var KEY = 'countryquiz.language';
  var SUPPORTED = ['de', 'en'];
  var SHOW_ANYWAY_MS = 2000;

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (error) {
      return null;
    }
  }

  function pick(saved, preferred) {
    if (SUPPORTED.indexOf(saved) >= 0) return saved;
    for (var i = 0; i < preferred.length; i++) {
      var base = String(preferred[i]).toLowerCase().split('-')[0];
      if (SUPPORTED.indexOf(base) >= 0) return base;
    }
    return 'en';
  }

  var browser = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  var language = pick(stored(), browser);
  var root = document.documentElement;
  root.lang = language;
  if (language !== 'de') {
    root.setAttribute('data-translating', '');
    setTimeout(function () { root.removeAttribute('data-translating'); }, SHOW_ANYWAY_MS);
  }
})();
