// Countries whose English name takes "the" in a sentence: "the Netherlands", "the
// United States", "the Gambia". Every other country is named without it. Unlike
// in German the article never changes, and plural names take a singular verb
// ("The Netherlands is").
export const WITH_THE = new Set([
  'AE', 'AX', 'BQ', 'BS', 'CC', 'CD', 'CF', 'CG', 'CK', 'DO', 'FK', 'FO', 'GB', 'GM', 'IO', 'KM', 'KY', 'MH',
  'MP', 'MV', 'NL', 'PH', 'PN', 'SB', 'SC', 'TC', 'TF', 'UM', 'US', 'VG', 'VI',
]);
