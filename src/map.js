import { geoArea, geoCentroid, geoNaturalEarth1, geoPath, select, zoom, zoomIdentity } from '../vendor/d3.bundle.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';

const WIDTH = 1000;
const HEIGHT = 520;
const EARTH_RADIUS_KM = 6371;
const BORDER_WIDTH_PX = 0.8;
const TARGET_WIDTH_PX = 2.5;
const TARGET_RING_MAX_AREA_KM2 = 8000;
const TARGET_RING_RADIUS_PX = 11;
// Beyond this the map data runs out of detail and borders turn angular.
const MAX_ZOOM = 100;
// Low enough that neighboring land stays in view: isolated islands need context.
const MAX_AUTO_ZOOM = 12;
const TARGET_VIEW_SHARE = 0.35;
const ZOOM_DURATION_MS = 750;

// Largest polygon of a feature: drives the target ring and auto-zoom, so that e.g.
// Alaska or far-away islands do not pull the view away from the mainland.
function largestPolygon(feature) {
  const { geometry } = feature;
  if (geometry.type !== 'MultiPolygon') return feature;
  const polygons = geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
  return polygons.reduce((largest, polygon) => (geoArea(polygon) > geoArea(largest) ? polygon : largest));
}

// `getTooltipText(code)` returns the text to show for a country, or null.
export function createMap(canvas, targetCanvas, tooltip, world, getTooltipText) {
  const projection = geoNaturalEarth1().fitExtent([[4, 4], [WIDTH - 4, HEIGHT - 4]], { type: 'Sphere' });
  const path = geoPath(projection);
  const context = canvas.getContext('2d', { alpha: true });
  const targetContext = targetCanvas.getContext('2d');
  const hitContext = document.createElement('canvas').getContext('2d');

  const shapes = world.features.map((feature) => ({
    code: feature.properties.id,
    path: new Path2D(path(feature)),
    bounds: path.bounds(feature),
    color: 'var(--never)',
    feature,
  }));
  const shapeByCode = new Map(shapes.filter((shape) => COUNTRY_BY_CODE.has(shape.code)).map((shape) => [shape.code, shape]));

  let transform = zoomIdentity;
  let target = null;
  let drawScheduled = false;
  let drawCount = 0;
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;
  let resolvedColors = new Map();

  // Canvas cannot read CSS variables, so style.css tokens are resolved here.
  function resolveColor(color) {
    if (!resolvedColors.has(color)) {
      const styles = getComputedStyle(document.documentElement);
      resolvedColors.set(color, color.replace(/var\((--[\w-]+)\)/g, (_, name) => styles.getPropertyValue(name).trim()));
    }
    return resolvedColors.get(color);
  }

  // Fits the whole map into the canvas: world units to CSS pixels at zoom 1.
  function baseView() {
    const scale = Math.min(cssWidth / WIDTH, cssHeight / HEIGHT);
    return { scale, x: (cssWidth - WIDTH * scale) / 2, y: (cssHeight - HEIGHT * scale) / 2 };
  }

  function applyWorldTransform(ctx) {
    const base = baseView();
    const scale = pixelRatio * transform.k * base.scale;
    ctx.setTransform(
      scale, 0, 0, scale,
      pixelRatio * (transform.x + transform.k * base.x),
      pixelRatio * (transform.y + transform.k * base.y),
    );
    return scale;
  }

  function isVisible([[x0, y0], [x1, y1]]) {
    const base = baseView();
    const left = (transform.invertX(0) - base.x) / base.scale;
    const right = (transform.invertX(cssWidth) - base.x) / base.scale;
    const top = (transform.invertY(0) - base.y) / base.scale;
    const bottom = (transform.invertY(cssHeight) - base.y) / base.scale;
    return x1 >= left && x0 <= right && y1 >= top && y0 <= bottom;
  }

  function drawCountries() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = applyWorldTransform(context);
    context.lineWidth = (BORDER_WIDTH_PX * pixelRatio) / scale;
    context.strokeStyle = resolveColor('var(--country-stroke)');
    for (const shape of shapes) {
      if (!isVisible(shape.bounds)) continue;
      context.fillStyle = resolveColor(shape.color);
      context.fill(shape.path);
      context.stroke(shape.path);
    }
  }

  function drawTarget() {
    targetContext.setTransform(1, 0, 0, 1, 0, 0);
    targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (!target) return;
    const scale = applyWorldTransform(targetContext);
    targetContext.strokeStyle = resolveColor('var(--target)');
    targetContext.lineWidth = (TARGET_WIDTH_PX * pixelRatio) / scale;
    targetContext.lineJoin = 'round';
    targetContext.stroke(target.path);
    if (target.ring) {
      targetContext.beginPath();
      targetContext.arc(target.ring[0], target.ring[1], (TARGET_RING_RADIUS_PX * pixelRatio) / scale, 0, 2 * Math.PI);
      targetContext.stroke();
    }
  }

  function scheduleDraw() {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      drawCount += 1;
      drawCountries();
      drawTarget();
    });
  }

  const zoomBehavior = zoom()
    .scaleExtent([1, MAX_ZOOM])
    .on('zoom', (event) => {
      transform = event.transform;
      scheduleDraw();
    });
  const canvasSelection = select(canvas).call(zoomBehavior).on('dblclick.zoom', null);

  function resize() {
    cssWidth = canvas.clientWidth || 1;
    cssHeight = canvas.clientHeight || 1;
    pixelRatio = window.devicePixelRatio || 1;
    for (const element of [canvas, targetCanvas]) {
      element.width = Math.round(cssWidth * pixelRatio);
      element.height = Math.round(cssHeight * pixelRatio);
    }
    zoomBehavior.translateExtent([[-cssWidth, -cssHeight], [cssWidth * 2, cssHeight * 2]]);
    scheduleDraw();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    resolvedColors = new Map();
    scheduleDraw();
  });

  function zoomToBounds([[x0, y0], [x1, y1]], animate) {
    const base = baseView();
    const width = Math.max((x1 - x0) * base.scale, 0.01);
    const height = Math.max((y1 - y0) * base.scale, 0.01);
    const fit = TARGET_VIEW_SHARE * Math.min(cssWidth / width, cssHeight / height);
    const k = Math.max(1, Math.min(MAX_AUTO_ZOOM, fit));
    const next = zoomIdentity
      .translate(cssWidth / 2, cssHeight / 2)
      .scale(k)
      .translate(-(base.x + ((x0 + x1) / 2) * base.scale), -(base.y + ((y0 + y1) / 2) * base.scale));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    canvasSelection.interrupt();
    if (animate && !reducedMotion) canvasSelection.transition().duration(ZOOM_DURATION_MS).call(zoomBehavior.transform, next);
    else canvasSelection.call(zoomBehavior.transform, next);
  }

  function setColor(code, color) {
    const shape = shapeByCode.get(code);
    if (shape) {
      shape.color = color;
      scheduleDraw();
    }
  }

  function highlight(code) {
    const shape = shapeByCode.get(code);
    const focus = largestPolygon(shape.feature);
    const isSmall = geoArea(shape.feature) * EARTH_RADIUS_KM ** 2 < TARGET_RING_MAX_AREA_KM2;
    target = { code, path: shape.path, ring: isSmall ? projection(geoCentroid(focus)) : null };
    zoomToBounds(path.bounds(focus), true);
    scheduleDraw();
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function codeAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const base = baseView();
    const x = (transform.invertX(clientX - rect.left) - base.x) / base.scale;
    const y = (transform.invertY(clientY - rect.top) - base.y) / base.scale;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const { code, bounds: [[x0, y0], [x1, y1]], path: shapePath } = shapes[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (shapeByCode.has(code) && hitContext.isPointInPath(shapePath, x, y)) return code;
    }
    return null;
  }

  function showTooltip(event) {
    const code = codeAt(event.clientX, event.clientY);
    const text = code ? getTooltipText(code) : null;
    if (!text) {
      hideTooltip();
      return;
    }
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left + 12;
    const y = event.clientY - rect.top + 12;
    tooltip.style.left = `${Math.min(x, rect.width - tooltip.offsetWidth - 4)}px`;
    tooltip.style.top = `${Math.min(y, rect.height - tooltip.offsetHeight - 4)}px`;
  }

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') showTooltip(event);
  });
  canvas.addEventListener('click', showTooltip);
  canvas.addEventListener('pointerleave', hideTooltip);

  // A canvas has no elements to inspect, so the browser tests go through this.
  canvas.mapTestApi = {
    targetCode: () => target?.code,
    hasTargetRing: () => Boolean(target?.ring),
    hasShape: (code) => shapeByCode.has(code),
    colorOf: (code) => resolveColor(shapeByCode.get(code).color),
    shapeCount: () => shapes.length,
    drawCount: () => drawCount,
    transform: () => transform.toString(),
    zoomTo: (code) => zoomToBounds(path.bounds(largestPolygon(shapeByCode.get(code).feature)), false),
    pointOf: (code) => {
      const [wx, wy] = projection(geoCentroid(largestPolygon(shapeByCode.get(code).feature)));
      const base = baseView();
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + transform.applyX(base.x + wx * base.scale),
        y: rect.top + transform.applyY(base.y + wy * base.scale),
      };
    },
  };

  return { setColor, highlight, hideTooltip };
}
