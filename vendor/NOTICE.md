# Third-party code and data

- `vendor/d3.bundle.js`: ES module bundle (esbuild, minified) of d3-geo 3.1.1,
  d3-zoom 3.0.0 and d3-selection 3.0.0 with their dependencies. ISC License,
  Copyright Mike Bostock. https://d3js.org
- `data/world.json`: derived from Natural Earth 1:50m Admin 0 Countries (public
  domain). https://www.naturalearthdata.com. Features carry an `id` property
  (ISO alpha-2 where available). Changes: Somaliland merged into Somalia,
  Northern Cyprus into Cyprus, Crimea assigned to Ukraine; overseas parts of
  France and the Netherlands, Svalbard and Jan Mayen, and Christmas Island and
  the Cocos Islands split into their own ISO entries; simplified with mapshaper.
  Bouvet Island, Gibraltar, Tokelau and the U.S. Minor Outlying Islands are
  added from the 1:10m ISO edition, because the 1:50m data lacks them.
