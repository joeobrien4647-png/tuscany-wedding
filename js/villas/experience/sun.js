// The sun over La Conca on Saturday 29 May 2027, from NOAA's solar position equations (geometric elevation, as
// data/villas-model.json's track). Used by the v1 bridge as the stand-in for realism's sky.sunAt until Phase 0, and
// by the time bar to find its marks by search rather than by a table.
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// minutes after local midnight (CEST, UTC+2) to { az, el } in degrees
export function solarPosition(minutes, { lat, lon, date = '2027-05-29', utcOffsetMin = 120 }) {
  const [Y, M, D] = date.split('-').map(Number);
  const utcMin = minutes - utcOffsetMin;
  const a = Math.floor((14 - M) / 12), y = Y + 4800 - a, m = M + 12 * a - 3;
  const jdn = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const jd = jdn - 0.5 + utcMin / 1440;
  const jc = (jd - 2451545) / 36525;
  const L = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const Ma = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(rad(Ma)) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(rad(2 * Ma)) * (0.019993 - 0.000101 * jc) + Math.sin(rad(3 * Ma)) * 0.000289;
  const app = L + C - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * jc));
  const obl = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(rad(125.04 - 1934.136 * jc));
  const dec = deg(Math.asin(Math.sin(rad(obl)) * Math.sin(rad(app))));
  const yv = Math.tan(rad(obl / 2)) ** 2;
  const eot = 4 * deg(yv * Math.sin(2 * rad(L)) - 2 * e * Math.sin(rad(Ma)) + 4 * e * yv * Math.sin(rad(Ma)) * Math.cos(2 * rad(L))
    - 0.5 * yv * yv * Math.sin(4 * rad(L)) - 1.25 * e * e * Math.sin(2 * rad(Ma)));
  const tst = (((utcMin + eot + 4 * lon) % 1440) + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const cz = Math.sin(rad(lat)) * Math.sin(rad(dec)) + Math.cos(rad(lat)) * Math.cos(rad(dec)) * Math.cos(rad(ha));
  const zen = deg(Math.acos(Math.max(-1, Math.min(1, cz))));
  const ca = (Math.sin(rad(lat)) * Math.cos(rad(zen)) - Math.sin(rad(dec))) / (Math.cos(rad(lat)) * Math.sin(rad(zen)));
  const az0 = deg(Math.acos(Math.max(-1, Math.min(1, ca))));
  const az = ha > 0 ? (az0 + 180) % 360 : (540 - az0) % 360;
  return { az, el: 90 - zen };
}

// the moment (fractional minutes) in [from, to] where f turns true: scanned every `step` minutes, then halved down
// to a second. Rounded by the caller, so "20:43.2" reads as 20:43 as data/villas-model.json has it.
export function crossing(f, from, to, step = 5) {
  for (let a = from; a < to; a += step) {
    const b = Math.min(to, a + step);
    if (f(a)) return a;
    if (!f(b)) continue;
    let lo = a, hi = b;
    while (hi - lo > 1 / 60) { const mid = (lo + hi) / 2; if (f(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  return null;
}

// the minute of the highest sun between `from` and `to`, by golden-section search
export function peak(g, from, to) {
  const r = (Math.sqrt(5) - 1) / 2;
  let a = from, b = to, c = b - r * (b - a), d = a + r * (b - a);
  while (b - a > 1 / 60) {
    if (g(c) > g(d)) b = d; else a = c;
    c = b - r * (b - a); d = a + r * (b - a);
  }
  return (a + b) / 2;
}
