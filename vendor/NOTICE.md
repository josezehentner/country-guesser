# Third-party code and data

- `vendor/d3.bundle.js`: ES module bundle (esbuild, minified) of d3-geo 3.1.1,
  d3-zoom 3.0.0 and d3-selection 3.0.0 with their dependencies. ISC License,
  Copyright Mike Bostock. https://d3js.org. Only the functions exported in
  `tools/d3-bundle.js` are included. Rebuild with `npm run build:vendor`.
- `data/world.json`: derived from Natural Earth 1:10m Admin 0 Map Units (public
  domain). https://www.naturalearthdata.com. Features carry an `id` property
  (ISO alpha-2 where available). Changes: units merged per ISO entry; Somaliland
  merged into Somalia, Northern Cyprus, the UN buffer zone, Akrotiri and Dhekelia
  into Cyprus, Guantanamo Bay into Cuba, the UNDOF zone into Syria and the Korean
  DMZ into the two Koreas; Crimea assigned to Ukraine; Jan Mayen assigned to SJ
  and the U.S. minor islands to UM. Simplified to 25% with mapshaper, except
  entries under 100 km², which keep full detail and are drawn on top. Entries
  under 40 km² are enlarged to 40 km² around their own centers, so these shapes
  are deliberately not to scale.
- `data/lakes.json`: derived from Natural Earth 1:10m Lakes, version 5.0.0
  (public domain). https://www.naturalearthdata.com. Built by `tools/lakes.js`:
  only lakes of at least 5,000 km² and the pieces of them that Natural Earth
  keeps separately, German names from `name_de`, shores
  simplified to within about 1.3 km and coordinates rounded to 4 decimals.
- `images/modes/*.svg` and `images/menu-background.svg`: drawn from
  `data/world.json` by `tools/mode-images.js` and `tools/menu-background.js`,
  so the same Natural Earth source applies.
- `fonts/bangers/Bangers-Regular.ttf`: Bangers by The Bangers Project Authors,
  SIL Open Font License 1.1 (`fonts/bangers/OFL.txt`), unchanged.
  https://github.com/googlefonts/bangers
