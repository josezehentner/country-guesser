import { LANG } from '../src/language.js';

// Central list of quizzed countries: all 249 ISO 3166-1 entries plus Kosovo,
// grouped by region (a continent, or the Middle East) and rated by difficulty. Everything else in data/world.json is drawn on the map
// but never asked.

export const CONTINENTS = {
  EU: 'Europa',
  ME: 'Naher Osten',
  AS: 'Asien',
  AF: 'Afrika',
  NA: 'Nordamerika',
  SA: 'Südamerika',
  OC: 'Ozeanien',
  AN: 'Antarktis',
};

const CODES_BY_CONTINENT = {
  EU: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK AX FO GG GI IM JE SJ',
  ME: 'AE BH EG IL IQ IR JO KW LB OM PS QA SA SY TR YE',
  AS: 'AF AM AZ BD BN BT CN GE ID IN JP KG KH KP KR KZ LA LK MM MN MV MY NP PH PK SG TH TJ TL TM TW UZ VN CC CX HK IO MO',
  AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW EH RE SH YT',
  NA: 'AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA SV TT US VC AI AW BL BM BQ CW GL GP KY MF MQ MS PM PR SX TC VG VI',
  SA: 'AR BO BR CL CO EC GY PE PY SR UY VE FK GF',
  OC: 'AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS AS CK GU MP NC NF NU PF PN TK UM WF',
  AN: 'AQ BV GS HM TF',
};

export const LEVELS = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
};

// Very well-known countries.
const EASY = new Set(
  'DE FR GB IT ES PT NL BE CH AT PL SE NO FI DK IE GR RU UA TR EG SA IR IQ IL US CA MX BR AR CL CO PE VE CU CN JP KR KP IN PK ID TH VN PH AF KZ MN AU NZ ZA NG KE MA ET DZ CD LY'.split(' '),
);

// Everything that is no UN member: territories, dependencies, disputed areas and
// observers. With the small island states below they make up the hard level.
export const NOT_UN_MEMBERS = new Set(
  'XK AX FO GG GI IM JE SJ VA PS TW CC CX HK IO MO EH RE SH YT AI AW BL BM BQ CW GL GP KY MF MQ MS PM PR SX TC VG VI FK GF AS CK GU MP NC NF NU PF PN TK UM WF AQ BV GS HM TF'.split(' '),
);

// UN member island states smaller than about 1000 km²; well-known ones stay medium.
const SMALL_ISLAND_STATES = new Set('NR TV PW MH FM KI TO KN LC VC GD DM AG BB MV SC ST'.split(' '));

function levelOf(code) {
  if (NOT_UN_MEMBERS.has(code) || SMALL_ISLAND_STATES.has(code)) return 'hard';
  return EASY.has(code) ? 'easy' : 'medium';
}

// Preferred display names where Intl.DisplayNames is unusual for a quiz, per language.
const NAME_OVERRIDES = {
  de: {
    CD: 'Demokratische Republik Kongo',
    CG: 'Republik Kongo',
    CI: 'Elfenbeinküste',
    HK: 'Hongkong',
    MO: 'Macau',
    PS: 'Palästina',
    TL: 'Osttimor',
    US: 'Vereinigte Staaten',
    VA: 'Vatikanstadt',
    XK: 'Kosovo',
  },
  // The common English name, without "&" and "St.", and without the "SAR China"
  // and "(Burma)" that Intl adds.
  en: {
    AG: 'Antigua and Barbuda',
    BA: 'Bosnia and Herzegovina',
    BL: 'Saint Barthélemy',
    CD: 'Democratic Republic of the Congo',
    CG: 'Republic of the Congo',
    CI: 'Ivory Coast',
    GS: 'South Georgia and the South Sandwich Islands',
    HK: 'Hong Kong',
    HM: 'Heard Island and McDonald Islands',
    KN: 'Saint Kitts and Nevis',
    LC: 'Saint Lucia',
    MF: 'Saint Martin',
    MM: 'Myanmar',
    MO: 'Macau',
    PM: 'Saint Pierre and Miquelon',
    PS: 'Palestine',
    SH: 'Saint Helena',
    SJ: 'Svalbard and Jan Mayen',
    ST: 'São Tomé and Príncipe',
    TC: 'Turks and Caicos Islands',
    TL: 'East Timor',
    TR: 'Turkey',
    TT: 'Trinidad and Tobago',
    UM: 'U.S. Minor Outlying Islands',
    VC: 'Saint Vincent and the Grenadines',
    WF: 'Wallis and Futuna',
    XK: 'Kosovo',
  },
};

const displayNames = { de: new Intl.DisplayNames(['de'], { type: 'region' }), en: new Intl.DisplayNames(['en'], { type: 'region' }) };
const perLanguage = (make) => ({ de: make('de'), en: make('en') });

// `names` and `intlNames` hold both languages; `name` and `intlName` are the ones
// of the page.
export const COUNTRIES = Object.entries(CODES_BY_CONTINENT).flatMap(([continent, codes]) =>
  codes.split(' ').map((code) => {
    const intlNames = perLanguage((language) => displayNames[language].of(code));
    const names = perLanguage((language) => NAME_OVERRIDES[language][code] ?? intlNames[language]);
    return { code, continent, level: levelOf(code), intlName: intlNames[LANG], name: names[LANG], intlNames, names };
  }),
);

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
