export const DEG = Math.PI / 180;

export function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function easeInOutQuad(x: number): number {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(x: number): number {
  const t = clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export interface LayoutMetrics {
  mPort: boolean;
  mLand: boolean;
  mHp: boolean;
  sticky: boolean;
  uc: number;
  us: number;
  u: number;
}

export function computeLayoutMetrics(vw: number, vh: number): LayoutMetrics {
  const mPort = vw <= vh;
  const mLand = vw > vh && vh < 500;
  const mHp = mPort || mLand || vw < 768;
  const sticky = !mPort && !mLand;
  const uc =
    vh < 520
      ? Math.min(vw / 1440, Math.max(vh / 900, 0.6))
      : Math.min(vw / 1440, vh / 900);
  const us = vw / 1440;
  const u = mLand
    ? vh / 430
    : mHp
      ? Math.min(vw / 430, 1.4)
      : Math.min(vw / 1440, vh / 960);
  return { mPort, mLand, mHp, sticky, uc, us, u };
}

export function lonLatToUnit(lonDeg: number, latDeg: number): [number, number, number] {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  const cLat = Math.cos(lat);
  return [cLat * Math.sin(lon), Math.sin(lat), cLat * Math.cos(lon)];
}

export function projectPoint(
  px: number,
  py: number,
  pz: number,
  viewLonRad: number,
  tiltRad: number
): [number, number, number] {
  const cosV = Math.cos(viewLonRad);
  const sinV = Math.sin(viewLonRad);
  const cosT = Math.cos(tiltRad);
  const sinT = Math.sin(tiltRad);
  const x1 = px * cosV - pz * sinV;
  const z1 = px * sinV + pz * cosV;
  const y2 = py * cosT - z1 * sinT;
  const z2 = py * sinT + z1 * cosT;
  return [x1, y2, z2];
}

export function buildSlerpArc(
  a: [number, number, number],
  b: [number, number, number],
  steps = 56
): [number, number, number][] {
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const omega = Math.acos(dot);
  const sinO = Math.sin(omega);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    let x: number, y: number, z: number;
    if (sinO < 1e-5) {
      x = a[0] + (b[0] - a[0]) * f;
      y = a[1] + (b[1] - a[1]) * f;
      z = a[2] + (b[2] - a[2]) * f;
    } else {
      const k0 = Math.sin((1 - f) * omega) / sinO;
      const k1 = Math.sin(f * omega) / sinO;
      x = k0 * a[0] + k1 * b[0];
      y = k0 * a[1] + k1 * b[1];
      z = k0 * a[2] + k1 * b[2];
    }
    const lift = 1 + (0.07 + (0.42 * omega) / Math.PI) * Math.sin(Math.PI * f);
    pts.push([x * lift, y * lift, z * lift]);
  }
  return pts;
}

export function computeGlowState(hwrapH: number, scrollY: number, vh: number) {
  const e = (hwrapH - scrollY) / vh - 0.47;
  const edge = e > 0.12 ? e : -0.03 + 0.15 * Math.exp((e - 0.12) / 0.15);
  const opacity = 1 - easeInOutQuad(clamp((-0.12 - e) / 0.4, 0, 1));
  const k = clamp((0.95 - e) / 0.42, 0, 1);
  return { e, edge, opacity, k };
}

export function formatThinThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

export function cubicBezierY(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number
): number {
  const target = clamp(x, 0, 1);
  if (target <= 0) return 0;
  if (target >= 1) return 1;
  const sampleX = (t: number) =>
    3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const sampleY = (t: number) =>
    3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let lo = 0;
  let hi = 1;
  let mid = target;
  for (let i = 0; i < 20; i++) {
    mid = (lo + hi) * 0.5;
    if (sampleX(mid) < target) lo = mid;
    else hi = mid;
  }
  return sampleY(mid);
}

export type AcquisitionMode = 'buy' | 'lease' | 'service';

export interface VendingQuoteInput {
  mode: AcquisitionMode | 'repair';
  modelId: string;
  units: number;
  name: string;
  email: string;
  company: string;
}

const BUY_PRICES: Record<string, number> = {
  combo: 4850,
  cooler: 6900,
  beverage: 5200,
  market: 11400,
  fleet: 0,
};

const LEASE_PRICES: Record<string, number> = {
  combo: 165,
  cooler: 225,
  beverage: 178,
  market: 360,
  fleet: 0,
};

export function estimateQuoteTotal(
  mode: AcquisitionMode | 'repair',
  modelId: string,
  units: number
): { headline: string; subline: string } {
  const count = Math.max(1, Math.min(100, Math.round(units || 1)));
  if (mode === 'service') {
    return {
      headline: '$0 upfront',
      subline: `${count} ${count === 1 ? 'unit' : 'units'} installed, stocked & maintained free`,
    };
  }
  if (mode === 'repair' || modelId === 'fleet') {
    return {
      headline: `$${(count * 95).toLocaleString('en-US')} / mo`,
      subline: `Preventative service & dispatch coverage for ${count} ${count === 1 ? 'machine' : 'machines'}`,
    };
  }
  if (mode === 'lease') {
    const unitRate = LEASE_PRICES[modelId] ?? 165;
    return {
      headline: `$${(unitRate * count).toLocaleString('en-US')} / mo`,
      subline: `36-month lease-to-own · ${count} ${count === 1 ? 'unit' : 'units'}`,
    };
  }
  const unitPrice = BUY_PRICES[modelId] ?? 4850;
  return {
    headline: `$${(unitPrice * count).toLocaleString('en-US')}`,
    subline: `Outright purchase · ${count} ${count === 1 ? 'unit' : 'units'} with 2-yr warranty`,
  };
}

export function validateQuoteForm(input: VendingQuoteInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Enter a valid business email address.';
  }
  if (!input.company.trim()) errors.company = 'Enter a company or building name.';
  if (!Number.isFinite(input.units) || input.units < 1 || input.units > 100) {
    errors.units = 'Choose between 1 and 100 machines.';
  }
  return errors;
}
