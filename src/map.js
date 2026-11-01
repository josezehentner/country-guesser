import { geoArea, geoCentroid, geoNaturalEarth1, geoPath, select, zoom, zoomIdentity } from '../vendor/d3.bundle.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 520;
const EARTH_RADIUS_KM = 6371;
const TARGET_RING_MAX_AREA_KM2 = 8000;
const TARGET_RING_RADIUS_PX = 11;
// Beyond this the map data runs out of detail and borders turn angular.
const MAX_ZOOM = 100;
// Low enough that neighboring land stays in view: isolated islands need context.
const MAX_AUTO_ZOOM = 12;
const TARGET_VIEW_SHARE = 0.35;
const ZOOM_DURATION_MS = 750;

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

// Largest polygon of a feature: drives the target ring and auto-zoom, so that e.g.
// Alaska or far-away islands do not pull the view away from the mainland.
function largestPolygon(feature) {
  const { geometry } = feature;
  if (geometry.type !== 'MultiPolygon') return feature;
  const polygons = geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
  return polygons.reduce((largest, polygon) => (geoArea(polygon) > geoArea(largest) ? polygon : largest));
}

// `getTooltipText(code)` returns the text to show for a country, or null.
export function createMap(svg, tooltip, world, getTooltipText) {
  const projection = geoNaturalEarth1().fitExtent([[4, 4], [WIDTH - 4, HEIGHT - 4]], { type: 'Sphere' });
  const path = geoPath(projection);

  const root = createSvgElement('g');
  const countriesLayer = createSvgElement('g');
  const targetLayer = createSvgElement('g');
  root.append(countriesLayer, targetLayer);
  svg.append(root);

  const countries = new Map();
  for (const feature of world.features) {
    const code = feature.properties.id;
    const quizzed = COUNTRY_BY_CODE.has(code);
    const element = createSvgElement('path', { d: path(feature), class: 'country' });
    if (!quizzed) {
      countriesLayer.append(element);
      continue;
    }
    element.dataset.code = code;
    countriesLayer.append(element);

    countries.set(code, {
      element,
      focus: largestPolygon(feature),
      isSmall: geoArea(feature) * EARTH_RADIUS_KM ** 2 < TARGET_RING_MAX_AREA_KM2,
    });
  }

  let scale = 1;
  let targetRing = null;

  // Keeps the target ring at a constant on-screen size, independent of zoom and window size.
  function updateTargetRingSize() {
    if (!targetRing) return;
    const unitsPerPixel = 1 / ((svg.getScreenCTM()?.a || 1) * scale);
    targetRing.setAttribute('r', TARGET_RING_RADIUS_PX * unitsPerPixel);
  }

  const zoomBehavior = zoom()
    .scaleExtent([1, MAX_ZOOM])
    .translateExtent([[-WIDTH / 2, -HEIGHT], [WIDTH * 1.5, HEIGHT * 2]])
    .on('zoom', ({ transform }) => {
      scale = transform.k;
      root.setAttribute('transform', transform.toString());
      updateTargetRingSize();
    });
  const svgSelection = select(svg).call(zoomBehavior).on('dblclick.zoom', null);
  window.addEventListener('resize', updateTargetRingSize);

  function zoomToCountry(entry) {
    const [[x0, y0], [x1, y1]] = path.bounds(entry.focus);
    const fit = TARGET_VIEW_SHARE * Math.min(WIDTH / Math.max(x1 - x0, 0.01), HEIGHT / Math.max(y1 - y0, 0.01));
    const k = Math.max(1, Math.min(MAX_AUTO_ZOOM, fit));
    const transform = zoomIdentity
      .translate(WIDTH / 2, HEIGHT / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    svgSelection.interrupt();
    if (reducedMotion) svgSelection.call(zoomBehavior.transform, transform);
    else svgSelection.transition().duration(ZOOM_DURATION_MS).call(zoomBehavior.transform, transform);
  }

  function setColor(code, color) {
    const entry = countries.get(code);
    if (entry) entry.element.style.fill = color;
  }

  function highlight(code) {
    const entry = countries.get(code);
    targetLayer.replaceChildren();
    targetRing = null;
    targetLayer.append(createSvgElement('path', { class: 'target-outline', d: entry.element.getAttribute('d') }));
    if (entry.isSmall) {
      const [cx, cy] = projection(geoCentroid(entry.focus));
      targetRing = createSvgElement('circle', { class: 'target-ring', cx, cy });
      targetLayer.append(targetRing);
    }
    updateTargetRingSize();
    zoomToCountry(entry);
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function showTooltip(event) {
    const code = event.target.dataset?.code;
    const text = code ? getTooltipText(code) : null;
    if (!text) {
      hideTooltip();
      return;
    }
    tooltip.textContent = text;
    tooltip.hidden = false;
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left + 12;
    const y = event.clientY - bounds.top + 12;
    tooltip.style.left = `${Math.min(x, bounds.width - tooltip.offsetWidth - 4)}px`;
    tooltip.style.top = `${Math.min(y, bounds.height - tooltip.offsetHeight - 4)}px`;
  }

  svg.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') showTooltip(event);
  });
  svg.addEventListener('click', showTooltip);
  svg.addEventListener('pointerleave', hideTooltip);

  return { setColor, highlight, hideTooltip };
}
