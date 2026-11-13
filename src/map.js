import { geoArea, geoContains, geoDistance, geoInterpolate, geoOrthographic, geoPath, select, zoom, zoomIdentity } from '../vendor/d3.bundle.js';
import { COUNTRY_BY_CODE } from '../data/countries.js';
import { coastLines } from './coasts.js';
import { boundingCap, simplifyLine, simplifyPolygon } from './simplify.js';

const DEGREES = 180 / Math.PI;
const RADIANS = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const BORDER_WIDTH_PX = 0.8;
// Comic look, like the land in the menu: a thick ink outline around the globe and
// a hard shadow offset to the bottom right.
const GLOBE_OUTLINE_PX = 3;
const GLOBE_SHADOW_PX = [6, 7];
const TARGET_WIDTH_PX = 3;
// The light green highlight gets an ink edge on both sides, or it would vanish
// on the beige land.
const TARGET_EDGE_PX = 1.5;
// Countries smaller than this are hard to hit: in "Länder finden" a click this
// close to them counts too.
const SMALL_AREA_KM2 = 8000;
const SMALL_HIT_RADIUS_PX = 11;
const SMALL_FLASH_WIDTH_PX = 8;
// Globe radius at zoom 1, as a share of the smaller canvas side.
const GLOBE_SIZE = 0.45;
// Beyond this the map data runs out of detail and borders turn angular.
const MAX_ZOOM = 100;
// Low enough that neighboring land stays in view: isolated islands need context.
const MAX_AUTO_ZOOM = 3;
const TARGET_VIEW_SHARE = 0.2;
const ZOOM_DURATION_MS = 750;
// In "Grenzgänger" start and end are shown together when they fit on the front of
// the globe, within ROUTE_FIT_ANGLE of its center. Otherwise the globe shows the
// end for ROUTE_HOLD_MS, then flies to the start in ROUTE_FLIGHT_MS, zooming out on
// the way.
const ROUTE_FIT_ANGLE = 60 * (Math.PI / 180);
const ROUTE_VIEW_SHARE = 0.9;
const MAX_ROUTE_ZOOM = 6;
const ROUTE_HOLD_MS = 250;
const ROUTE_FLIGHT_MS = 850;
// Without borders the land is one fill, and only the coastlines get a line, as thin
// as the borders elsewhere. Thick lines along every border, half covered by the
// fill again, cost three times the drawing time, and even a coast of 1.2 px twice.
const COAST_WIDTH_PX = BORDER_WIDTH_PX;
// After an answer the asked country lights up once (right) or pulses twice (wrong).
const FLASH_OPACITY = 0.85;
const FLASHES = {
  good: { pulses: 1, durationMs: 600 },
  bad: { pulses: 2, durationMs: 1000 },
};
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
// During the flight from start to end the copies are this many steps coarser, about
// 1.4 px, which the motion hides. The whole globe in view otherwise costs Firefox
// more time per frame than a frame has. The flight ends at full detail.
const FLIGHT_COARSER_STEPS = 3;

function polygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

// Largest polygon of a shape: drives the auto-zoom, so that e.g.
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

const NEVER = 'var(--never)';

const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Gentler at both ends than `ease`, so the quick flight across the globe has no rush in
// the middle: its top speed is 1.6 times the average instead of 3 times.
const glide = (t) => (1 - Math.cos(Math.PI * t)) / 2;

// `onSelect(event)` is called for a click or tap on the globe. `lakes` are drawn as
// water over the countries. With `hideBorders` the land is one surface with coasts
// only, and a country shows its borders once it gets a color of its own.
export function createMap(canvas, targetCanvas, world, onSelect = () => false, lakes = { features: [] }, { hideBorders = false } = {}) {
  const projection = geoOrthographic().clipAngle(90).precision(0);
  const context = canvas.getContext('2d', { alpha: true });
  const targetContext = targetCanvas.getContext('2d');
  const path = geoPath(projection, context);
  const targetPath = geoPath(projection, targetContext);
  // Own layer below the target outline, so animating its opacity repaints nothing else.
  const flashCanvas = document.createElement('canvas');
  flashCanvas.className = 'map-flash';
  flashCanvas.setAttribute('aria-hidden', 'true');
  targetCanvas.before(flashCanvas);
  const flashContext = flashCanvas.getContext('2d');
  const flashPath = geoPath(projection, flashContext);

  // Per country and polygon, the stretches of coast, only needed without borders.
  const coasts = hideBorders ? coastLines(world.features) : [];
  const shapes = world.features.map((feature, i) => {
    const polygons = polygonsOf(feature.geometry);
    return {
      code: feature.properties.id, feature, polygons, caps: polygons.map(boundingCap), levels: [], color: NEVER,
      coasts: coasts[i] ?? [], coastLevels: [],
    };
  });
  const shapeByCode = new Map(shapes.filter((shape) => COUNTRY_BY_CODE.has(shape.code)).map((shape) => [shape.code, shape]));
  const lakeShapes = lakes.features.map((feature) => {
    const polygons = polygonsOf(feature.geometry);
    return { name: feature.properties.name, polygons, caps: polygons.map(boundingCap), levels: [] };
  });

  let center = START_CENTER;
  let k = 1;
  let radius = 1;
  let lodScale = 0;
  // Outlined countries, each { code, shape, color }: the asked one, or start and end.
  let targets = [];
  let route = null;
  let tourTimer = null;
  let flashing = null;
  let animation = null;
  let coarse = false;
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

  // Each copy must stay sharp up to the zoom where the next one takes over. Levels
  // start at -FLIGHT_COARSER_STEPS, so they are stored shifted by that.
  const levelTolerance = (level) => LOD_ERROR_PX / (lodScale * 2 ** ((level + 1) / LOD_STEPS_PER_DOUBLING));

  function polygonsAt(shape, level) {
    if (k >= LOD_MAX_ZOOM) return shape.polygons;
    const slot = level + FLIGHT_COARSER_STEPS;
    shape.levels[slot] ??= shape.polygons.map((polygon) => simplifyPolygon(polygon, levelTolerance(level)));
    return shape.levels[slot];
  }

  // The coasts at the same detail as the polygons they belong to.
  function coastsAt(shape, level) {
    if (k >= LOD_MAX_ZOOM) return shape.coasts;
    const slot = level + FLIGHT_COARSER_STEPS;
    shape.coastLevels[slot] ??= shape.coasts.map((lines) => lines.map((line) => simplifyLine(line, levelTolerance(level))));
    return shape.coastLevels[slot];
  }

  const detailLevel = () => Math.floor(Math.log2(k) * LOD_STEPS_PER_DOUBLING) - (coarse ? FLIGHT_COARSER_STEPS : 0);

  // Orthographic projection of points that lie fully on the front of the globe.
  // It needs no clipping, and skipping d3's stream makes it about three times faster.
  function traceFrontPoints(ctx, ring) {
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
  }

  // A fill closes each ring by itself, and the rings end where they start. Only a
  // stroke needs `closePath` for the corner at the start. In Chrome every
  // `closePath` takes longer the longer the path already is: on the land of the
  // whole globe, thousands of rings in one path, it cost 35 ms per frame.
  function traceFrontRing(ctx, ring, close) {
    traceFrontPoints(ctx, ring);
    if (close) ctx.closePath();
  }

  // Adds the shape's polygons that may be on screen to the current path, at the
  // detail the zoom needs. Returns false when none is. With `close: false` the path
  // can only be filled, not stroked.
  function traceShape(ctx, clippedPath, shape, { close = true } = {}) {
    const angle = viewAngle();
    let polygons = null;
    const edge = [];
    shape.caps.forEach((cap, i) => {
      const distance = geoDistance(center, cap.center);
      if (distance - cap.radius >= angle) return;
      polygons ??= polygonsAt(shape, detailLevel());
      if (distance + cap.radius < Math.PI / 2) for (const ring of polygons[i]) traceFrontRing(ctx, ring, close);
      else edge.push(polygons[i]);
    });
    if (edge.length) clippedPath({ type: 'MultiPolygon', coordinates: edge });
    return Boolean(polygons);
  }

  // Adds the shape's coasts that may be on screen to the current path, like
  // traceShape, as open lines.
  function traceCoasts(ctx, clippedPath, shape) {
    const angle = viewAngle();
    let lines = null;
    const edge = [];
    shape.caps.forEach((cap, i) => {
      if (!shape.coasts[i]?.length) return;
      const distance = geoDistance(center, cap.center);
      if (distance - cap.radius >= angle) return;
      lines ??= coastsAt(shape, detailLevel());
      if (distance + cap.radius < Math.PI / 2) for (const line of lines[i]) traceFrontPoints(ctx, line);
      else edge.push(...lines[i]);
    });
    if (edge.length) clippedPath({ type: 'MultiLineString', coordinates: edge });
  }

  function drawCountries() {
    const started = performance.now();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.save();
    context.translate(...GLOBE_SHADOW_PX);
    context.beginPath();
    path({ type: 'Sphere' });
    context.fillStyle = resolveColor('var(--globe-shadow)');
    context.fill();
    context.restore();
    context.beginPath();
    path({ type: 'Sphere' });
    context.fillStyle = resolveColor('var(--ocean)');
    context.fill();
    drawnShapes = 0;
    if (hideBorders) drawHiddenLand();
    context.lineWidth = BORDER_WIDTH_PX;
    context.strokeStyle = resolveColor('var(--country-stroke)');
    for (const shape of shapes) {
      if (hideBorders && !hasOwnColor(shape)) continue;
      context.beginPath();
      if (!traceShape(context, path, shape)) continue;
      drawnShapes += 1;
      context.fillStyle = resolveColor(shape.color);
      context.fill();
      context.stroke();
    }
    // Natural Earth cuts some lakes into pieces, e.g. along borders. A shore twice as
    // wide, then the water over its inner half, leaves no line where pieces meet.
    context.beginPath();
    if (traceLakes(context, path)) {
      context.lineWidth = 2 * BORDER_WIDTH_PX;
      context.stroke();
      context.fillStyle = resolveColor('var(--ocean)');
      context.fill();
    }
    context.beginPath();
    path({ type: 'Sphere' });
    context.lineWidth = GLOBE_OUTLINE_PX;
    context.strokeStyle = resolveColor('var(--ink)');
    context.stroke();
    lastDrawMs = performance.now() - started;
  }

  const hasOwnColor = (shape) => shape.color !== NEVER;

  // All countries without a color of their own as one fill, so no seam shows
  // between neighbors, and then only their coasts as lines.
  function drawHiddenLand() {
    context.beginPath();
    for (const shape of shapes) {
      if (!hasOwnColor(shape) && traceShape(context, path, shape, { close: false })) drawnShapes += 1;
    }
    context.fillStyle = resolveColor(NEVER);
    context.fill();
    context.beginPath();
    for (const shape of shapes) if (!hasOwnColor(shape)) traceCoasts(context, path, shape);
    context.lineJoin = 'round';
    context.lineWidth = COAST_WIDTH_PX;
    context.strokeStyle = resolveColor('var(--ink)');
    context.stroke();
    context.lineJoin = 'miter';
  }

  // Adds the visible lakes to the current path. Returns false when none is.
  function traceLakes(ctx, clippedPath) {
    let any = false;
    for (const lake of lakeShapes) any = traceShape(ctx, clippedPath, lake) || any;
    return any;
  }

  function drawTarget() {
    targetContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    targetContext.clearRect(0, 0, cssWidth, cssHeight);
    targetContext.lineJoin = 'round';
    for (const { shape, color } of targets) {
      targetContext.beginPath();
      if (!traceShape(targetContext, targetPath, shape)) continue;
      targetContext.strokeStyle = resolveColor('var(--ink)');
      targetContext.lineWidth = TARGET_WIDTH_PX + 2 * TARGET_EDGE_PX;
      targetContext.stroke();
      targetContext.strokeStyle = resolveColor(color);
      targetContext.lineWidth = TARGET_WIDTH_PX;
      targetContext.stroke();
    }
  }

  // Small countries also get a thick outline in the flash color, or a fill of a
  // few pixels could not be seen.
  function drawFlash() {
    flashContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    flashContext.clearRect(0, 0, cssWidth, cssHeight);
    if (!flashing) return;
    flashContext.fillStyle = flashContext.strokeStyle = resolveColor(`var(--flash-${flashing.kind})`);
    flashContext.lineJoin = 'round';
    flashContext.lineWidth = SMALL_FLASH_WIDTH_PX;
    flashContext.beginPath();
    if (!traceShape(flashContext, flashPath, flashing.shape)) return;
    flashContext.fill();
    if (isSmall(flashing.shape)) flashContext.stroke();
    // Lakes stay water while the country around them lights up.
    flashContext.save();
    flashContext.globalCompositeOperation = 'destination-out';
    flashContext.beginPath();
    if (traceLakes(flashContext, flashPath)) flashContext.fill();
    flashContext.restore();
  }

  function draw() {
    drawCount += 1;
    drawCountries();
    drawFlash();
    drawTarget();
  }

  function scheduleDraw() {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      draw();
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
      if (event.sourceEvent?.type === 'mousemove') canvas.classList.add('dragging');
      const [x, y] = gesture.apply(previous.invert([cssWidth / 2, cssHeight / 2]));
      const [dx, dy] = [x - cssWidth / 2, y - cssHeight / 2];
      if (gesture.k !== k) dragSteps = null;
      else if (dragSteps && event.sourceEvent) dragSteps.push({ time: performance.now(), dx, dy });
      k = gesture.k;
      turnBy(dx, dy);
    })
    .on('end', (event) => {
      // A wheel zoom ends a moment later on its own: only letting go ends a drag.
      if (event.sourceEvent?.type === 'mouseup') canvas.classList.remove('dragging');
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
    if (coarse) {
      coarse = false;
      scheduleDraw();
    }
    clearTimeout(tourTimer);
    tourTimer = null;
  }

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // With `dip`, the zoom falls by that factor (in log scale) in the middle of the
  // way, so a long flight zooms out to show where it goes.
  // With `rough`, the borders are coarser until the last frame.
  function viewTo(nextCenter, nextK, animate, { durationMs = ZOOM_DURATION_MS, dip = 0, easing = ease, rough = false } = {}) {
    stopAnimation();
    if (!animate || reducedMotion()) {
      setView(nextCenter, nextK);
      return;
    }
    const startK = k;
    const between = geoInterpolate(center, nextCenter);
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / durationMs);
      const e = easing(t);
      const point = between(e);
      const zoomLevel = startK * (nextK / startK) ** e * Math.exp(-dip * 4 * e * (1 - e));
      coarse = rough && t < 1;
      setView(Number.isFinite(point[0]) ? point : nextCenter, Math.max(1, zoomLevel));
      animation = t < 1 ? requestAnimationFrame(step) : null;
    };
    animation = requestAnimationFrame(step);
  }

  // Zoom at which a cap fills `share` of the smaller canvas side.
  function fitZoom(cap, maxZoom, share = TARGET_VIEW_SHARE) {
    const size = 2 * Math.sin(Math.min(cap.radius, Math.PI / 2)) * radius;
    const fit = (share * Math.min(cssWidth, cssHeight)) / Math.max(size, 1e-9);
    return Math.max(1, Math.min(maxZoom, fit));
  }

  const mainCap = (shape) => shape.caps[largestPolygon(shape)];

  function focusOn(shape, maxZoom, animate) {
    const cap = mainCap(shape);
    viewTo(cap.center, fitZoom(cap, maxZoom), animate);
  }

  // Smallest view that holds both caps, as a cap around their midpoint.
  function capAround(a, b) {
    const middle = geoInterpolate(a.center, b.center)(0.5);
    const reach = (cap) => geoDistance(middle, cap.center) + cap.radius;
    return { center: middle, radius: Math.max(reach(a), reach(b)) };
  }

  // Shows start and end of a route: together if they fit on the front of the globe,
  // or else the end first and then a flight to the start, where the player begins.
  function showRoute(animate = true) {
    if (!route) return;
    const [start, end] = [route.start, route.end].map((code) => mainCap(shapeByCode.get(code)));
    const both = capAround(start, end);
    if (both.radius <= ROUTE_FIT_ANGLE) {
      viewTo(both.center, fitZoom(both, MAX_ROUTE_ZOOM, ROUTE_VIEW_SHARE), animate);
      return;
    }
    viewTo(end.center, fitZoom(end, MAX_AUTO_ZOOM), animate);
    // Only this view's animation is stopped by a new one; the timer runs on.
    const hold = () => {
      const startK = fitZoom(start, MAX_AUTO_ZOOM);
      // Halfway there the whole globe is in view.
      const dip = Math.max(0, (Math.log(k) + Math.log(startK)) / 2);
      viewTo(start.center, startK, true, { durationMs: ROUTE_FLIGHT_MS, dip, easing: glide, rough: true });
    };
    clearTimeout(tourTimer);
    tourTimer = setTimeout(hold, animate && !reducedMotion() ? ZOOM_DURATION_MS + ROUTE_HOLD_MS : ROUTE_HOLD_MS);
  }

  function resize() {
    cssWidth = canvas.clientWidth || 1;
    cssHeight = canvas.clientHeight || 1;
    pixelRatio = window.devicePixelRatio || 1;
    for (const element of [canvas, flashCanvas, targetCanvas]) {
      element.width = Math.round(cssWidth * pixelRatio);
      element.height = Math.round(cssHeight * pixelRatio);
    }
    radius = GLOBE_SIZE * Math.min(cssWidth, cssHeight);
    if (radius !== lodScale) {
      lodScale = radius;
      for (const shape of shapes) {
        shape.levels = [];
        shape.coastLevels = [];
      }
    }
    updateProjection();
    // Resizing clears the canvas: drawing at once keeps it from blinking empty,
    // e.g. when the filters open or close.
    draw();
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

  const isSmall = (shape) => geoArea(shape.feature) * EARTH_RADIUS_KM ** 2 < SMALL_AREA_KM2;

  // Tells the page that a country got marked or lost its mark, e.g. to show the
  // button that turns the globe back to it.
  const announceTarget = () => canvas.dispatchEvent(new Event('targetchange'));

  // Marks a country and, unless `focus` is false, turns it to the front and center.
  function highlight(code, { focus = true } = {}) {
    const shape = shapeByCode.get(code);
    route = null;
    targets = [{ code, shape, color: 'var(--target)' }];
    if (focus) focusOn(shape, MAX_AUTO_ZOOM, true);
    scheduleDraw();
    announceTarget();
  }

  // Outlines the start and the end of a route in their colors and shows both.
  function setRoute(start, end) {
    route = { start, end };
    targets = [
      { code: start, shape: shapeByCode.get(start), color: 'var(--route-start)' },
      { code: end, shape: shapeByCode.get(end), color: 'var(--route-end)' },
    ];
    showRoute();
    scheduleDraw();
    announceTarget();
  }

  // Turns a country to the front, keeping the zoom unless it needs less to fit,
  // if it is not in view already.
  function reveal(code) {
    const shape = shapeByCode.get(code);
    const cap = mainCap(shape);
    if (geoDistance(center, cap.center) + Math.min(cap.radius, 0.2) < viewAngle() * 0.8) return;
    viewTo(cap.center, Math.min(k, Math.max(1, fitZoom(cap, MAX_AUTO_ZOOM))), true);
  }

  // Turns the marked country back to the front and center, as when it was asked,
  // after the player turned or zoomed away from it. For a route it shows start and
  // end again.
  function refocus() {
    if (route) showRoute();
    else if (targets.length) focusOn(targets[0].shape, MAX_AUTO_ZOOM, true);
  }

  const hasTarget = () => targets.length > 0;

  // Lights the country up in green, or pulses it twice in red, after an answer. It
  // runs on while the next question already turns the globe. With reduced motion
  // the color shows steadily for the same time instead of pulsing.
  function flash(code, correct) {
    const kind = correct ? 'good' : 'bad';
    const { pulses, durationMs } = FLASHES[kind];
    const steady = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const keyframes = steady
      ? [{ opacity: FLASH_OPACITY }, { opacity: FLASH_OPACITY }]
      : [{ opacity: 0 }, ...Array.from({ length: pulses }, () => [{ opacity: FLASH_OPACITY }, { opacity: 0 }]).flat()];
    flashing?.animation.cancel();
    const shape = shapeByCode.get(code);
    const animation = flashCanvas.animate(keyframes, durationMs);
    flashing = { code, kind, shape, animation };
    animation.onfinish = () => {
      if (flashing?.animation !== animation) return;
      flashing = null;
      scheduleDraw();
    };
    scheduleDraw();
  }

  function clearHighlight() {
    targets = [];
    route = null;
    scheduleDraw();
    announceTarget();
  }

  function inShape({ caps, polygons }, location) {
    return caps.some((cap, j) => geoDistance(location, cap.center) <= cap.radius
      && geoContains({ type: 'Polygon', coordinates: polygons[j] }, location));
  }

  function codeAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const point = [clientX - rect.left, clientY - rect.top];
    if (Math.hypot(point[0] - cssWidth / 2, point[1] - cssHeight / 2) > radius * k) return null;
    const location = projection.invert(point);
    if (!location || !Number.isFinite(location[0])) return null;
    // A lake is water, like the ocean, even though the country data covers it.
    if (lakeShapes.some((lake) => inShape(lake, location))) return null;
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
  // click within a few pixels of them counts too.
  function hits(code, clientX, clientY) {
    if (codeAt(clientX, clientY) === code) return true;
    const shape = shapeByCode.get(code);
    if (!isSmall(shape)) return false;
    const rect = canvas.getBoundingClientRect();
    return screenDistance(shape, [clientX - rect.left, clientY - rect.top]) <= SMALL_HIT_RADIUS_PX;
  }

  // The globe never names a country on hover or click: that would give answers away.
  canvas.addEventListener('click', onSelect);

  // Screen position of a point on the globe, in client coordinates.
  function clientPoint(location) {
    const [x, y] = projection(location);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + x, y: rect.top + y };
  }

  // A canvas has no elements to inspect, so the browser tests go through this.
  canvas.mapTestApi = {
    targetCode: () => targets[0]?.code,
    targetCodes: () => targets.map(({ code }) => code),
    hidesBorders: () => hideBorders,
    // True while the globe still shows the end and is about to fly to the start.
    touring: () => Boolean(tourTimer),
    // True while the flight to the end draws coarser borders.
    roughDetail: () => coarse,
    // The point the globe turns to the center to show a route that fits at once.
    routeCenter: (start, end) => capAround(mainCap(shapeByCode.get(start)), mainCap(shapeByCode.get(end))),
    codeAt,
    // The point the globe turns to the center for a country.
    centerOf: (code) => { const shape = shapeByCode.get(code); return shape.caps[largestPolygon(shape)].center; },
    flashing: () => (flashing ? { code: flashing.code, kind: flashing.kind } : null),
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

  return { setColor, highlight, setRoute, reveal, refocus, hasTarget, flash, clearHighlight, codeAt, hits };
}
