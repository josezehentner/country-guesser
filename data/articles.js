// Countries whose German name takes the definite article in a sentence: "die
// Schweiz", "der Iran", "die Niederlande". Every other country is named without one.
//
// gender: 'f', 'm', 'n' or 'pl' (plural).
// name, dative: the name after the article, where it differs from the plain name.
// After an article an adjective changes its ending ("Vereinigte Staaten" becomes
// "die Vereinigten Staaten"), and a plural noun gains an -n in the dative ("den
// Niederlanden").
export const ARTICLES = {
  // Feminine: die, der
  AQ: { gender: 'f' },
  BV: { gender: 'f' },
  CD: { gender: 'f', dative: 'Demokratischen Republik Kongo' },
  CF: { gender: 'f', dative: 'Zentralafrikanischen Republik' },
  CG: { gender: 'f' },
  CH: { gender: 'f' },
  CI: { gender: 'f' },
  CX: { gender: 'f' },
  DO: { gender: 'f', dative: 'Dominikanischen Republik' },
  EH: { gender: 'f' },
  IM: { gender: 'f' },
  MD: { gender: 'f' },
  MN: { gender: 'f' },
  NF: { gender: 'f' },
  SK: { gender: 'f' },
  TR: { gender: 'f' },
  UA: { gender: 'f' },
  VA: { gender: 'f' },

  // Masculine: der, den, dem
  IQ: { gender: 'm' },
  IR: { gender: 'm' },
  LB: { gender: 'm' },
  NE: { gender: 'm' },
  SD: { gender: 'm' },
  SN: { gender: 'm' },
  SS: { gender: 'm' },
  TD: { gender: 'm' },
  YE: { gender: 'm' },

  // Neuter: das, dem
  GB: { gender: 'n', name: 'Vereinigte Königreich', dative: 'Vereinigten Königreich' },
  IO: { gender: 'n', name: 'Britische Territorium im Indischen Ozean', dative: 'Britischen Territorium im Indischen Ozean' },

  // Plural: die, den
  AE: { gender: 'pl', name: 'Vereinigten Arabischen Emirate', dative: 'Vereinigten Arabischen Emiraten' },
  AX: { gender: 'pl' },
  BQ: { gender: 'pl', name: 'Karibischen Niederlande', dative: 'Karibischen Niederlanden' },
  BS: { gender: 'pl' },
  CC: { gender: 'pl' },
  CK: { gender: 'pl' },
  FK: { gender: 'pl' },
  FO: { gender: 'pl', dative: 'Färöern' },
  KM: { gender: 'pl' },
  KY: { gender: 'pl' },
  MH: { gender: 'pl' },
  MP: { gender: 'pl', name: 'Nördlichen Marianen' },
  MV: { gender: 'pl' },
  NL: { gender: 'pl', dative: 'Niederlanden' },
  PH: { gender: 'pl' },
  PN: { gender: 'pl' },
  SB: { gender: 'pl' },
  SC: { gender: 'pl' },
  TC: { gender: 'pl' },
  TF: { gender: 'pl', name: 'Französischen Süd- und Antarktisgebiete', dative: 'Französischen Süd- und Antarktisgebieten' },
  UM: { gender: 'pl', name: 'Amerikanischen Überseeinseln' },
  US: { gender: 'pl', name: 'Vereinigten Staaten' },
  VG: { gender: 'pl', name: 'Britischen Jungferninseln' },
  VI: { gender: 'pl', name: 'Amerikanischen Jungferninseln' },
};
