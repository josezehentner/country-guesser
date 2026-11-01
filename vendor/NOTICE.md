# Third-party code and data

- `vendor/d3.bundle.js`: ES module bundle (esbuild, minified) of d3-geo 3.1.1,
  d3-zoom 3.0.0 and d3-selection 3.0.0 with their dependencies. ISC License,
  Copyright Mike Bostock. https://d3js.org
- `data/world.json`: derived from Natural Earth 1:10m Admin 0 Map Units (public
  domain). https://www.naturalearthdata.com. Features carry an `id` property
  (ISO alpha-2 where available). Changes: units merged per ISO entry; Somaliland
  merged into Somalia, Northern Cyprus, the UN buffer zone, Akrotiri and Dhekelia
  into Cyprus, Guantanamo Bay into Cuba, the UNDOF zone into Syria and the Korean
  DMZ into the two Koreas; Crimea assigned to Ukraine; Jan Mayen assigned to SJ
  and the U.S. minor islands to UM. Simplified to 25% with mapshaper, except
  entries under 100 km², which keep full detail and are drawn on top.
