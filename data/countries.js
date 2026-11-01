// Central list of quizzed countries: all 249 ISO 3166-1 entries plus Kosovo,
// grouped by continent. Everything else in data/world.json is drawn on the map
// but never asked.

export const CONTINENTS = {
  EU: 'Europa',
  AS: 'Asien',
  AF: 'Afrika',
  NA: 'Nordamerika',
  SA: 'Südamerika',
  OC: 'Ozeanien',
  AN: 'Antarktis',
};

const CODES_BY_CONTINENT = {
  EU: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK AX FO GG GI IM JE SJ',
  AS: 'AE AF AM AZ BD BH BN BT CN GE ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE CC CX HK IO MO',
  AF: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW EH RE SH YT',
  NA: 'AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA SV TT US VC AI AW BL BM BQ CW GL GP KY MF MQ MS PM PR SX TC VG VI',
  SA: 'AR BO BR CL CO EC GY PE PY SR UY VE FK GF',
  OC: 'AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS AS CK GU MP NC NF NU PF PN TK UM WF',
  AN: 'AQ BV GS HM TF',
};

// Preferred display names where Intl.DisplayNames is unusual for a quiz.
const NAME_OVERRIDES = {
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
};

const displayNames = new Intl.DisplayNames(['de'], { type: 'region' });

export const COUNTRIES = Object.entries(CODES_BY_CONTINENT).flatMap(([continent, codes]) =>
  codes.split(' ').map((code) => ({
    code,
    continent,
    intlName: displayNames.of(code),
    name: NAME_OVERRIDES[code] ?? displayNames.of(code),
  })),
);

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
