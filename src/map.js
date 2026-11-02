import { geoArea, geoContains, geoDistance, geoInterpolate, geoOrthographic, geoPath, select, zoom, zoomIdentity } from '../vendor/d3.bundle.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { boundingCap, simplifyPolygon } from './simplify.js';

const DEGREES = 180 / Math.PI;
const RADIANS = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const BORDER_WIDTH_PX = 0.8;
const TARGET_WIDTH_PX = 2.5;
const TARGET_RING_MAX_AREA_KM2 = 8000;
const TARGET_RING_RADIUS_PX = 11;
// Globe radius at zoom 1, as a share of the smaller canvas side.
const GLOBE_SIZE = 0.45;
// Beyond this the map data runs out of detail and borders turn angular.
const MAX_ZOOM = 100;
// Low enough that neighboring land stays in view: isolated islands need context.
const MAX_AUTO_ZOOM = 3;
const TARGET_VIEW_SHARE = 0.2;
const ZOOM_DURATION_MS = 750;
const START_CENTER = [10, 30];
// After a quick drag the globe keeps turning and slows down with this time constant.
// Only movement in the last INERTIA_WINDOW_MS before letting go counts.
const INERTIA_TIME_MS = 325;
const INERTIA_WINDOW_MS = 100;
const INERTIA_MIN_SPEED = 0.15;
const INERTIA_MAX_SPEED = 4;
const INERTIA_STOP_SPEED = 0.01;
// Below zoom LOD_MAX_ZOOM, borders are drawn from simplified copies that stay within
// LOD_ERROR_PX CSS pixels of the full data, less than the border line is wide, so
// zooming never shows less detail. There is one copy per half doubling of the zoom.
// CSS rather than device pixels: on high-density screens it saves about a third of
// the drawing time.
const LOD_MAX_ZOOM = 32;
const LOD_STEPS_PER_DOUBLING = 2;
const LOD_ERROR_PX = 0.5;

function polygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

// Largest polygon of a shape: drives the target ring and auto-zoom, so that e.g.
// Alaska or far-away islands do not pull the view away from the mainland.
function largestPolygon(shape) {
  const areas = shape.polygons.map((coordinates) => geoArea({ type: 'Polygon', coordinates }));
  return areas.indexOf(Math.max(...areas));
}

function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const [dx, dy] = [bx - ax, by - ay];
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Screen point inside a polygon on the front of the globe for the tests to click
// on, as far from its border as the candidates allow. The centroid can lie outside,
// e.g. for crescent shapes like Somalia, or close to the edge of a thin atoll.
function clickablePoint(projection, polygon, centroid) {
  const contains = (point) => geoContains({ type: 'Polygon', coordinates: polygon }, projection.invert(point));
  const ring = polygon[0].map((point) => projection(point));
  const clearance = (point) => Math.min(...ring.slice(1).map((vertex, i) => segmentDistance(point, ring[i], vertex)));
  const first = projection(centroid);
  if (contains(first) && clearance(first) >= 3) return first;
  let [best, bestClearance] = [first, -1];
  const count = ring.length - 1;
  const stride = Math.max(1, Math.floor(count / 200));
  for (const share of [0.5, 0.33, 0.25]) {
    for (let i = 0; i < count; i += stride) {
      const [a, b] = [ring[i], ring[(i + Math.round(count * share)) % count]];
      const point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!contains(point)) continue;
      const distance = clearance(point);
      if (distance > bestClearance) [best, bestClearance] = [point, distance];
    }
  }
  return best;
}

const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// `getTooltipText(code)` returns the text to show for a country, or null.
// `onSelect(event)` is called for a click or tap on the globe and returns true when
// it used it, so no tooltip shows.
export function createMap(canvas, targetCanvas, tooltip, world, getTooltipText, onSelect = () => false) {
  const projection = geoOrthographic().clipAngle(90).precision(0);
  const context = canvas.getContext('2d', { alpha: true });
  const targetContext = targetCanvas.getContext('2d');
  const path = geoPath(projection, context);
  const targetPath = geoPath(projection, targetContext);

  const shapes = world.features.map((feature) => {
    const polygons = polygonsOf(feature.geometry);
    return { code: feature.properties.id, feature, polygons, caps: polygons.map(boundingCap), levels: [], color: 'var(--never)' };
  });
  const shapeByCode = new Map(shapes.filter((shape) => COUNTRY_BY_CODE.has(shape.code)).map((shape) => [shape.code, shape]));

  let center = START_CENTER;
  let k = 1;
  let radius = 1;
  let lodScale = 0;
  let target = null;
  let animation = null;
  let drawScheduled = false;
  let drawCount = 0;
  let drawnShapes = 0;
  let lastDrawMs = 0;
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

  function updateProjection() {
    projection.scale(radius * k).translate([cssWidth / 2, cssHeight / 2]).rotate([-center[0], -center[1]]);
  }

  // Angle from the view center to the furthest visible point on the globe.
  function viewAngle() {
    const corner = Math.hypot(cssWidth, cssHeight) / 2;
    return corner >= radius * k ? Math.PI / 2 : Math.asin(corner / (radius * k));
  }

  // Each copy must stay sharp up to the zoom where the next one takes over.
  function polygonsAt(shape, level) {
    if (k >= LOD_MAX_ZOOM) return shape.polygons;
    if (!shape.levels[level]) {
      const tolerance = LOD_ERROR_PX / (lodScale * 2 ** ((level + 1) / LOD_STEPS_PER_DOUBLING));
      shape.levels[level] = shape.polygons.map((polygon) => simplifyPolygon(polygon, tolerance));
    }
    return shape.levels[level];
  }

  const detailLevel = () => Math.floor(Math.log2(k) * LOD_STEPS_PER_DOUBLING);

  // Orthographic projection of a ring that lies fully on the front of the globe.
  // It needs no clipping, and skipping d3's stream makes it about three times faster.
  function traceFrontRing(ctx, ring) {
    const scale = radius * k;
    const [x0, y0] = [cssWidth / 2, cssHeight / 2];
    const lon0 = center[0] * RADIANS;
    const sinLat0 = Math.sin(center[1] * RADIANS);
    const cosLat0 = Math.cos(center[1] * RADIANS);
    for (let i = 0; i < ring.length; i++) {
      const lon = ring[i][0] * RADIANS - lon0;
      const lat = ring[i][1] * RADIANS;
      const cosLat = Math.cos(lat);
      const x = x0 + scale * cosLat * Math.sin(lon);
      const y = y0 - scale * (cosLat0 * Math.sin(lat) - sinLat0 * cosLat * Math.cos(lon));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // Adds the shape's polygons that may be on screen to the current path, at the
  // detail the zoom needs. Returns false when none is.
  function traceShape(ctx, clippedPath, shape) {
    const angle = viewAngle();
    let polygons = null;
    const edge = [];
    shape.caps.forEach((cap, i) => {
      const distance = geoDistance(center, cap.center);
      if (distance - cap.radius >= angle) return;
      polygons ??= polygonsAt(shape, detailLevel());
      if (distance + cap.radius < Math.PI / 2) for (const ring of polygons[i]) traceFrontRing(ctx, ring);
      else edge.push(polygons[i]);
    });
    if (edge.length) clippedPath({ type: 'MultiPolygon', coordinates: edge });
    return Boolean(polygons);
  }

  function drawCountries() {
    const started = performance.now();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.beginPath();
    path({ type: 'Sphere' });
    context.fillStyle = resolveColor('var(--ocean)');
    context.fill();
    context.lineWidth = BORDER_WIDTH_PX;
    context.strokeStyle = resolveColor('var(--country-stroke)');
    drawnShapes = 0;
    for (const shape of shapes) {
      context.beginPath();
      if (!traceShape(context, path, shape)) continue;
      drawnShapes += 1;
      context.fillStyle = resolveColor(shape.color);
      context.fill();
      context.stroke();
    }
    context.beginPath();
    path({ type: 'Sphere' });
    context.stroke();
    lastDrawMs = performance.now() - started;
  }

  function drawTarget() {
    targetContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    targetContext.clearRect(0, 0, cssWidth, cssHeight);
    if (!target) return;
    targetContext.strokeStyle = resolveColor('var(--target)');
    targetContext.lineWidth = TARGET_WIDTH_PX;
    targetContext.lineJoin = 'round';
    targetContext.beginPath();
    if (traceShape(targetContext, targetPath, target.shape)) targetContext.stroke();
    if (target.ring && geoDistance(center, target.ring) < Math.PI / 2) {
      const [x, y] = projection(target.ring);
      targetContext.beginPath();
      targetContext.arc(x, y, TARGET_RING_RADIUS_PX, 0, 2 * Math.PI);
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

  // d3-zoom handles wheel, drag and pinch. Its transform only serves to tell how far
  // a gesture moved: the globe turns so the point under the screen center follows.
  let gesture = zoomIdentity;
  let syncing = false;
  // Recent drag steps as { time, dx, dy } in CSS pixels, for the speed when letting go.
  let dragSteps = [];
  const zoomBehavior = zoom()
    .scaleExtent([1, MAX_ZOOM])
    .on('start', (event) => {
      if (!event.sourceEvent) return;
      stopAnimation();
      dragSteps = [];
    })
    .on('zoom', (event) => {
      const previous = gesture;
      gesture = event.transform;
      if (syncing) return;
      const [x, y] = gesture.apply(previous.invert([cssWidth / 2, cssHeight / 2]));
      const [dx, dy] = [x - cssWidth / 2, y - cssHeight / 2];
      if (gesture.k !== k) dragSteps = null;
      else if (dragSteps && event.sourceEvent) dragSteps.push({ time: performance.now(), dx, dy });
      k = gesture.k;
      turnBy(dx, dy);
    })
    .on('end', (event) => {
      if (event.sourceEvent && dragSteps) keepTurning(dragSteps);
      dragSteps = [];
    });
  const canvasSelection = select(canvas).call(zoomBehavior).on('dblclick.zoom', null);

  // Turns the globe as if its surface moved by dx, dy CSS pixels at the screen center.
  function turnBy(dx, dy) {
    const scale = radius * k;
    const cosLat = Math.max(0.2, Math.cos(center[1] / DEGREES));
    setCenter([center[0] - (dx / scale / cosLat) * DEGREES, center[1] + (dy / scale) * DEGREES]);
  }

  // Momentum: after a quick drag the globe turns on and slows down. A drag that
  // stopped before letting go, or that also zoomed, has none.
  function keepTurning(steps) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    const recent = steps.filter((step) => now - step.time < INERTIA_WINDOW_MS);
    if (recent.length < 2) return;
    const elapsed = Math.max(now - recent[0].time, 1000 / 60);
    let velocity = [recent.slice(1).reduce((sum, step) => sum + step.dx, 0) / elapsed, recent.slice(1).reduce((sum, step) => sum + step.dy, 0) / elapsed];
    const speed = Math.hypot(...velocity);
    if (speed < INERTIA_MIN_SPEED) return;
    if (speed > INERTIA_MAX_SPEED) velocity = velocity.map((v) => (v * INERTIA_MAX_SPEED) / speed);
    let last = now;
    const step = (time) => {
      const elapsedFrame = Math.max(0, time - last);
      last = time;
      turnBy(velocity[0] * elapsedFrame, velocity[1] * elapsedFrame);
      velocity = velocity.map((v) => v * Math.exp(-elapsedFrame / INERTIA_TIME_MS));
      animation = Math.hypot(...velocity) > INERTIA_STOP_SPEED ? requestAnimationFrame(step) : null;
    };
    animation = requestAnimationFrame(step);
  }

  function setCenter([lon, lat]) {
    center = [((((lon + 180) % 360) + 360) % 360) - 180, Math.max(-90, Math.min(90, lat))];
    updateProjection();
    scheduleDraw();
  }

  // Keeps d3-zoom's scale in step after the view changed without a gesture.
  function setView(nextCenter, nextK) {
    k = nextK;
    syncing = true;
    canvasSelection.call(zoomBehavior.transform, zoomIdentity.scale(k));
    syncing = false;
    setCenter(nextCenter);
  }

  function stopAnimation() {
    if (animation) cancelAnimationFrame(animation);
    animation = null;
  }

  function viewTo(nextCenter, nextK, animate) {
    stopAnimation();
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setView(nextCenter, nextK);
      return;
    }
    const startK = k;
    const between = geoInterpolate(center, nextCenter);
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / ZOOM_DURATION_MS);
      const point = between(ease(t));
      setView(Number.isFinite(point[0]) ? point : nextCenter, startK * (nextK / startK) ** ease(t));
      animation = t < 1 ? requestAnimationFrame(step) : null;
    };
    animation = requestAnimationFrame(step);
  }

  // Zoom at which the polygon fills TARGET_VIEW_SHARE of the smaller canvas side.
  function fitZoom(cap, maxZoom) {
    const size = 2 * Math.sin(Math.min(cap.radius, Math.PI / 2)) * radius;
    const fit = (TARGET_VIEW_SHARE * Math.min(cssWidth, cssHeight)) / Math.max(size, 1e-9);
    return Math.max(1, Math.min(maxZoom, fit));
  }

  function focusOn(shape, maxZoom, animate) {
    const cap = shape.caps[largestPolygon(shape)];
    viewTo(cap.center, fitZoom(cap, maxZoom), animate);
  }

  function resize() {
    cssWidth = canvas.clientWidth || 1;
    cssHeight = canvas.clientHeight || 1;
    pixelRatio = window.devicePixelRatio || 1;
    for (const element of [canvas, targetCanvas]) {
      element.width = Math.round(cssWidth * pixelRatio);
      element.height = Math.round(cssHeight * pixelRatio);
    }
    radius = GLOBE_SIZE * Math.min(cssWidth, cssHeight);
    if (radius !== lodScale) {
      lodScale = radius;
      for (const shape of shapes) shape.levels = [];
    }
    updateProjection();
    scheduleDraw();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    resolvedColors = new Map();
    scheduleDraw();
  });

  function setColor(code, color) {
    const shape = shapeByCode.get(code);
    if (shape) {
      shape.color = color;
      scheduleDraw();
    }
  }

  const isSmall = (shape) => geoArea(shape.feature) * EARTH_RADIUS_KM ** 2 < TARGET_RING_MAX_AREA_KM2;

  // Marks a country and, unless `focus` is false, turns it to the front and center.
  function highlight(code, { focus = true } = {}) {
    const shape = shapeByCode.get(code);
    target = { code, shape, ring: isSmall(shape) ? shape.caps[largestPolygon(shape)].center : null };
    if (focus) focusOn(shape, MAX_AUTO_ZOOM, true);
    scheduleDraw();
  }

  function clearHighlight() {
    target = null;
    scheduleDraw();
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function codeAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const point = [clientX - rect.left, clientY - rect.top];
    if (Math.hypot(point[0] - cssWidth / 2, point[1] - cssHeight / 2) > radius * k) return null;
    const location = projection.invert(point);
    if (!location || !Number.isFinite(location[0])) return null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const { code, caps, polygons } = shapes[i];
      if (!shapeByCode.has(code)) continue;
      for (let j = 0; j < caps.length; j++) {
        if (geoDistance(location, caps[j].center) > caps[j].radius) continue;
        if (geoContains({ type: 'Polygon', coordinates: polygons[j] }, location)) return code;
      }
    }
    return null;
  }

  // Distance in CSS pixels from a canvas point to the visible border of a shape.
  function screenDistance(shape, point) {
    let best = Infinity;
    for (const polygon of shape.polygons) {
      for (const ring of polygon) {
        for (let i = 1; i < ring.length; i++) {
          if (geoDistance(center, ring[i - 1]) >= Math.PI / 2 || geoDistance(center, ring[i]) >= Math.PI / 2) continue;
          best = Math.min(best, segmentDistance(point, projection(ring[i - 1]), projection(ring[i])));
        }
      }
    }
    return best;
  }

  // True if a click lands on the country. Small countries are hard to hit, so a
  // click as close as their ring's radius counts too.
  function hits(code, clientX, clientY) {
    if (codeAt(clientX, clientY) === code) return true;
    const shape = shapeByCode.get(code);
    if (!isSmall(shape)) return false;
    const rect = canvas.getBoundingClientRect();
    return screenDistance(shape, [clientX - rect.left, clientY - rect.top]) <= TARGET_RING_RADIUS_PX;
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
  canvas.addEventListener('click', (event) => {
    if (onSelect(event)) hideTooltip();
    else showTooltip(event);
  });
  canvas.addEventListener('pointerleave', hideTooltip);

  // Screen position of a point on the globe, in client coordinates.
  function clientPoint(location) {
    const [x, y] = projection(location);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + x, y: rect.top + y };
  }

  // A canvas has no elements to inspect, so the browser tests go through this.
  canvas.mapTestApi = {
    targetCode: () => target?.code,
    hasTargetRing: () => Boolean(target?.ring),
    hasShape: (code) => shapeByCode.has(code),
    colorOf: (code) => resolveColor(shapeByCode.get(code).color),
    shapeCount: () => shapes.length,
    drawCount: () => drawCount,
    drawnShapes: () => drawnShapes,
    lastDrawMs: () => lastDrawMs,
    view: () => ({ k, center }),
    lookAt: (location, zoomLevel) => viewTo(location, zoomLevel, false),
    zoomTo: (code) => focusOn(shapeByCode.get(code), MAX_ZOOM, false),
    pointOf: (code) => {
      const shape = shapeByCode.get(code);
      const index = largestPolygon(shape);
      const [x, y] = clickablePoint(projection, shape.polygons[index], shape.caps[index].center);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + x, y: rect.top + y };
    },
    pointAt: clientPoint,
    isFacing: (location) => geoDistance(center, location) < Math.PI / 2,
  };

  return { setColor, highlight, clearHighlight, hideTooltip, codeAt, hits };
}
