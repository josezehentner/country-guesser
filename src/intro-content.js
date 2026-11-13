// The short guide each mode opens with on a player's first visit, and again behind
// the "?" button: the rules, the filters on the left, the scale on the right and
// what the colors mean. Plain data without DOM, so it can be checked in Node.
//
// A guide is { title, sections }, a section { heading, items }, and an item either
// a line of text or { swatches, text }: a row of color samples with what they mean.
// A swatch is { color } with an optional `label` inside it and `ring` for the
// outline of the marked country.

const SCORE_SCALE = Array.from({ length: 10 }, (_, i) => ({ color: `var(--score-${i + 1})`, label: String(i + 1) }));

const NEXT_AFTER_TYPING =
  'Nach einer richtigen Antwort kommt das nächste Land von selbst. Nach einer falschen siehst du die Lösung und machst mit Enter weiter.';
const NEXT_AFTER_CLICK =
  'Liegst du falsch, dreht sich der Globus zum richtigen Land. Weiter geht es mit „Weiter“, Enter oder einem Klick auf den Globus.';
const DONT_KNOW = '„Weiß ich nicht“ zeigt die Lösung und zählt als falsch.';
const TOLERANCE = 'Groß- und Kleinschreibung, fehlende Umlaute und kleine Tippfehler sind egal.';

const FILTERS_TAB = 'Die Lasche „Filter“ am linken Rand öffnet und schließt sie. Mit der Maus am linken Rand gleiten sie kurz herein.';

const FILTERS = {
  heading: 'Links: Filter',
  items: [
    'Hier wählst du, welche Länder drankommen: nach Region und nach Schwierigkeit. Beides lässt sich kombinieren, z. B. nur die einfachen Länder Afrikas.',
    'Die Zahl neben jedem Häkchen sagt, wie viele Länder dazugehören. Darunter steht, wie viele gerade abgefragt werden.',
    FILTERS_TAB,
  ],
};

const SCALE = {
  heading: 'Rechts: Wissensstufen',
  items: [
    'Die Leiste von 0 bis 10 zeigt, welche Farbe zu welcher Punktzahl gehört. Auf dem Handy liegt sie unten über dem Eingabefeld.',
    'Mit dem Schieber daneben lässt du Länder weg, die du schon gut kannst: Steht er auf 7, kommen Länder mit 8, 9 oder 10 Punkten nicht mehr dran. Noch nie gefragte Länder bleiben immer dabei.',
  ],
};

const SCORE_COLORS = {
  heading: 'Farben',
  items: [
    { swatches: [{ color: 'var(--never)' }], text: 'Beige: noch nie gefragt' },
    { swatches: [{ color: 'var(--score-zero)', label: '0' }], text: 'Grau: 0 Punkte' },
    { swatches: SCORE_SCALE, text: 'Von Rot über Gelb nach Grün: 1 bis 10 Punkte. Grün heißt gemeistert.' },
    { swatches: [{ color: 'var(--never)', ring: true }], text: 'Hellgrüner Rand: das markierte Land' },
    { swatches: [{ color: 'var(--flash-good)' }, { color: 'var(--flash-bad)' }], text: 'Nach der Antwort leuchtet das Land grün (richtig) oder blinkt rot (falsch).' },
    'Die erste Antwort bringt 5 Punkte, wenn sie stimmt, sonst 3. Danach gibt jede richtige Antwort einen Punkt dazu, jede falsche oder „Weiß ich nicht“ zieht einen ab. Was du noch nicht gut kannst, kommt öfter dran.',
  ],
};

const controls = (recenter) => ({
  heading: 'Bedienung',
  items: [
    'Ziehen dreht den Globus, Mausrad oder zwei Finger zoomen.',
    recenter,
    'Die Zahlen oben zeigen, wie viele Länder du gemeistert, begonnen und noch nie gesehen hast. Der Balken zeigt deinen Gesamtfortschritt.',
    '⚙ sichert, lädt oder löscht deinen Fortschritt. ? öffnet diese Anleitung wieder.',
  ],
});

const RECENTER_MARKED = '⌖ „Zum Land“ oben rechts dreht den Globus zurück zum markierten Land.';
const RECENTER_AFTER = '⌖ „Zum Land“ oben rechts erscheint nach der Antwort und dreht den Globus zurück zum Land.';

const scoreGuide = (title, rules, recenter) => ({
  title,
  sections: [{ heading: 'Spielregeln', items: rules }, FILTERS, SCALE, SCORE_COLORS, controls(recenter)],
});

export const INTROS = {
  name: scoreGuide('Länder benennen', [
    'Ein Land auf dem Globus ist markiert. Tippe seinen Namen ein und drücke Enter.',
    `${TOLERANCE} Bekannte andere Namen wie „USA“ oder „UK“ zählen auch.`,
    NEXT_AFTER_TYPING,
    DONT_KNOW,
  ], RECENTER_MARKED),

  find: scoreGuide('Länder finden', [
    'Das Spiel nennt ein Land. Dreh den Globus und klick oder tipp es an.',
    'Bei sehr kleinen Ländern reicht ein Klick knapp daneben. Ein Klick aufs Meer zählt nicht.',
    NEXT_AFTER_CLICK,
    DONT_KNOW,
  ], RECENTER_AFTER),

  capitals: scoreGuide('Hauptstädte lernen', [
    'Ein Land auf dem Globus ist markiert. Tippe seine Hauptstadt ein und drücke Enter.',
    `${TOLERANCE} Deutsche, englische und einheimische Namen zählen, z. B. „Peking“ oder „Beijing“. Hat ein Land mehrere Hauptstädte, ist jede richtig.`,
    NEXT_AFTER_TYPING,
    DONT_KNOW,
  ], RECENTER_MARKED),

  'find-capitals': scoreGuide('Hauptstädte finden', [
    'Das Spiel nennt eine Hauptstadt. Klick oder tipp das Land an, zu dem sie gehört.',
    'Gibt es den Namen zweimal, z. B. Kingston in Jamaika und auf der Norfolkinsel, ist jedes der beiden Länder richtig.',
    NEXT_AFTER_CLICK,
    DONT_KNOW,
  ], RECENTER_AFTER),

  flags: scoreGuide('Flaggen erkennen', [
    'Oben siehst du eine Flagge. Tippe das Land ein, zu dem sie gehört, und drücke Enter.',
    `${TOLERANCE} Sehen zwei Flaggen gleich aus, z. B. die von Monaco und Indonesien, ist jedes der beiden Länder richtig.`,
    'Danach dreht sich der Globus zum Land, so lernst du auch, wo es liegt.',
    DONT_KNOW,
  ], RECENTER_AFTER),

  borders: {
    title: 'Grenzgänger',
    sections: [
      {
        heading: 'Spielregeln',
        items: [
          'Du bekommst ein Start- und ein Zielland auf einem Globus ohne Grenzen.',
          'Nenne die Länder dazwischen, in beliebiger Reihenfolge, bis ihre Landgrenzen Start und Ziel verbinden. Brücken und Tunnel zählen nicht.',
          'Du hast so viele Versuche, wie der kürzeste Weg Länder braucht, und vier mehr. Wie viele noch übrig sind, steht unter der Frage.',
          '„Weiß ich nicht“ beendet die Runde und zeigt, welche Länder gefehlt haben.',
        ],
      },
      {
        heading: 'Links: Filter',
        items: [
          'Hier wählst du die Regionen, in denen eine Runde liegt: Start, Ziel und ein kürzester Weg liegen dann darin.',
          FILTERS_TAB,
        ],
      },
      {
        heading: 'Farben',
        items: [
          { swatches: [{ color: 'var(--route-start)' }], text: 'Grün: Start' },
          { swatches: [{ color: 'var(--route-end)' }], text: 'Rot: Ziel' },
          { swatches: [{ color: 'var(--route-step)' }], text: 'Gelb: liegt auf einem kürzesten Weg' },
          { swatches: [{ color: 'var(--route-detour)' }], text: 'Grau: ein Umweg, kostet trotzdem einen Versuch' },
          { swatches: [{ color: 'var(--route-missing)' }], text: 'Orange: hat am Ende noch gefehlt' },
          'Die genannten Länder stehen in diesen Farben unter der Frage.',
        ],
      },
      {
        heading: 'Bedienung',
        items: [
          'Ziehen dreht den Globus, Mausrad oder zwei Finger zoomen.',
          '⌖ „Start & Ziel“ oben rechts zeigt Start und Ziel noch einmal.',
          'Die Zahlen oben zählen deine gelösten Runden, die auf einem kürzesten Weg gelösten und deine Serie. Der Balken zeigt den Anteil gelöster Runden.',
          '⚙ sichert, lädt oder löscht deinen Fortschritt. ? öffnet diese Anleitung wieder.',
        ],
      },
    ],
  },
};
