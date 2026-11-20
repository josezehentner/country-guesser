import { COUNTRIES } from './countries.js';

// Countries "Umrisse erkennen" does not ask: on the map their largest part is
// smaller than MIN_AREA_KM2 in src/silhouette.js, so its outline has only a few
// points and looks like any other blob. tests/unit/silhouette.test.js checks that
// this list matches data/world.json.
export const NO_SILHOUETTE = new Set(`
  AD AG AI AS AW AX BB BH BL BM BQ BV CC CK CV CW CX DM FM FO GD GG GI GP
  GU HK HM IM IO JE KI KM KN KY LC LI MC MF MH MO MP MQ MS MT MU MV NF NR
  NU PF PM PN PW SC SG SH SM ST SX TC TK TO TV UM VA VC VG VI WF WS YT
`.trim().split(/\s+/));

// Antarctica's outline on the map runs along the South Pole, so seen from above
// its center it comes out warped.
export const WARPED_SILHOUETTE = new Set(['AQ']);

export const SILHOUETTE_COUNTRIES = COUNTRIES.filter(({ code }) => !NO_SILHOUETTE.has(code) && !WARPED_SILHOUETTE.has(code));
