import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEG,
  buildSlerpArc,
  computeGlowState,
  computeLayoutMetrics,
  cubicBezierY,
  estimateQuoteTotal,
  formatThinThousands,
  lonLatToUnit,
  projectPoint,
  validateQuoteForm,
} from './kv-math';

test('layout metrics match desktop, portrait, and short landscape specs', () => {
  const desktop = computeLayoutMetrics(1440, 900);
  assert.equal(desktop.mPort, false);
  assert.equal(desktop.mLand, false);
  assert.equal(desktop.mHp, false);
  assert.equal(desktop.sticky, true);
  assert.equal(desktop.uc, 1);
  assert.equal(desktop.us, 1);
  assert.ok(Math.abs(desktop.u - 900 / 960) < 1e-9);

  const phone = computeLayoutMetrics(375, 812);
  assert.equal(phone.mPort, true);
  assert.equal(phone.mLand, false);
  assert.equal(phone.mHp, true);
  assert.equal(phone.sticky, false);
  assert.ok(Math.abs(phone.u - 375 / 430) < 1e-9);

  const tablet = computeLayoutMetrics(768, 1024);
  assert.equal(tablet.mPort, true);
  assert.equal(tablet.mHp, true);
  assert.equal(tablet.u, 1.4);

  const land = computeLayoutMetrics(568, 320);
  assert.equal(land.mPort, false);
  assert.equal(land.mLand, true);
  assert.equal(land.mHp, true);
  assert.equal(land.sticky, false);
  assert.ok(Math.abs(land.uc - 568 / 1440) < 1e-9);
  assert.ok(Math.abs(land.u - 320 / 430) < 1e-9);
});

test('vending network globe rotation moves land left-to-right and keeps hubs visible at t=0', () => {
  const newYork = lonLatToUnit(-74.01, 40.71);
  const chicago = lonLatToUnit(-87.63, 41.88);
  const london = lonLatToUnit(-0.13, 51.51);
  const pNY = projectPoint(newYork[0], newYork[1], newYork[2], -45 * DEG, 9 * DEG);
  const pCHI = projectPoint(chicago[0], chicago[1], chicago[2], -45 * DEG, 9 * DEG);
  const pLON = projectPoint(london[0], london[1], london[2], -45 * DEG, 9 * DEG);
  assert.ok(pNY[2] > 0, 'New York faces viewer at t=0');
  assert.ok(pCHI[2] > 0, 'Chicago faces viewer at t=0');
  assert.ok(pLON[2] > 0, 'London faces viewer at t=0');

  const pNYLater = projectPoint(newYork[0], newYork[1], newYork[2], -55 * DEG, 9 * DEG);
  assert.ok(pNYLater[0] > pNY[0], 'Land moves left to right as view longitude decreases');
});

test('route slerp arc lifts endpoints softly and peaks at midpoint', () => {
  const chi = lonLatToUnit(-87.63, 41.88);
  const lon = lonLatToUnit(-0.13, 51.51);
  const pts = buildSlerpArc(chi, lon, 56);
  assert.equal(pts.length, 57);
  assert.ok(Math.abs(Math.hypot(...pts[0]) - 1) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...pts[56]) - 1) < 1e-6);
  assert.ok(Math.hypot(...pts[28]) > 1.05);
});

test('horizon glow edge decelerates smoothly below 0.12 and fades out', () => {
  const vh = 900;
  const hwrapH = 1.65 * vh;
  const start = computeGlowState(hwrapH, 0, vh);
  assert.ok(Math.abs(start.e - 1.18) < 1e-6);
  assert.equal(start.k, 0);

  const mid = computeGlowState(hwrapH, 1.1 * vh, vh);
  assert.ok(mid.e < 0.12);
  assert.ok(mid.edge > -0.03 && mid.edge < 0.12);

  const end = computeGlowState(hwrapH, 1.7 * vh, vh);
  assert.equal(end.opacity, 0);
});

test('vending quote estimation and form validation handle buy, lease, full-service, and invalid inputs', () => {
  assert.equal(estimateQuoteTotal('buy', 'combo', 2).headline, '$9,700');
  assert.equal(estimateQuoteTotal('lease', 'cooler', 3).headline, '$675 / mo');
  assert.equal(estimateQuoteTotal('service', 'market', 1).headline, '$0 upfront');
  assert.equal(estimateQuoteTotal('repair', 'fleet', 4).headline, '$380 / mo');

  const invalid = validateQuoteForm({
    mode: 'buy',
    modelId: 'combo',
    units: 0,
    name: '',
    email: 'not-an-email',
    company: '',
  });
  assert.ok(invalid.name);
  assert.ok(invalid.email);
  assert.ok(invalid.company);
  assert.ok(invalid.units);

  const valid = validateQuoteForm({
    mode: 'service',
    modelId: 'cooler',
    units: 4,
    name: 'Jordan Lee',
    email: 'jordan@northtower.com',
    company: 'North Tower Logistics',
  });
  assert.deepEqual(valid, {});
});

test('thin space formatting and cubic-bezier recorder curve', () => {
  assert.equal(formatThinThousands(3200), '3\u2009200');
  assert.equal(cubicBezierY(0.4, 0.05, 0.55, 0.95, 0), 0);
  assert.ok(Math.abs(cubicBezierY(0.4, 0.05, 0.55, 0.95, 1) - 1) < 1e-4);
});

test('index.html embeds valid landdots JSON and vending conversion sections', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script type="application\/json" id="landdots">([\s\S]*?)<\/script>/);
  assert.ok(match, 'landdots script tag exists in index.html');
  const dots = JSON.parse(match[1]) as number[];
  assert.ok(Array.isArray(dots));
  assert.equal(dots.length % 2, 0);
  assert.ok(dots.length / 2 > 3700 && dots.length / 2 < 3820);
  assert.ok(html.includes('LD InterTech'));
  assert.ok(html.includes('id="machines"'));
  assert.ok(html.includes('id="quote"'));
  assert.ok(html.includes('__recTime'));
});
