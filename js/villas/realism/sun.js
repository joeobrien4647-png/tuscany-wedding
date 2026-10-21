// The sun (and the Milky Way) over La Conca for any minute of Saturday 29 May 2027, Central European Summer Time.
// NOAA's solar equations (the ones research/villas/data/sun.py uses for villas-model.json), so the sun is continuous
// from 05:00 to midnight. Elevations are geometric (no refraction), as in the model's track; sunset is the moment
// the elevation passes -0.833 degrees.
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

// { lat, lon } in degrees, date 'YYYY-MM-DD', minutes after local midnight, the zone's offset from UTC in minutes
export function solarPosition({ lat, lon }, date, minutes, utcOffsetMin = 120) {
  const [Y, M, D] = date.split('-').map(Number);
  const utcMin = minutes - utcOffsetMin;
  const jd = julianDay(Y, M, D) + utcMin / 1440;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const Mg = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = Mg * RAD;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const L0r = L0 * RAD;
  const eqTime = 4 * DEG * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
    - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  const tst = (((utcMin + eqTime + 4 * lon) % 1440) + 1440) % 1440;
  const ha = (tst / 4 - 180) * RAD;
  const phi = lat * RAD;
  const cosZ = Math.min(1, Math.max(-1, Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha)));
  const el = 90 - Math.acos(cosZ) * DEG;
  const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) * DEG + 540) % 360;
  return { az, el, jd };
}

// Right ascension and declination (degrees) -> { az, el } for the place and moment (low precision: fine for a sky).
export function equatorialToHorizon({ lat, lon }, jd, ra, dec) {
  const gmst = (((280.46061837 + 360.98564736629 * (jd - 2451545)) % 360) + 360) % 360;
  const H = (gmst + lon - ra) * RAD;
  const phi = lat * RAD, d = dec * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H)) * DEG;
  const az = (Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.cos(H) * Math.sin(phi)) * DEG + 360) % 360;
  return { az, el };
}

// The galaxy's north pole and centre (J2000), for the faint band of the Milky Way after dark.
export const GALACTIC = Object.freeze({ pole: { ra: 192.8595, dec: 27.1283 }, centre: { ra: 266.405, dec: -28.936 } });

// The minute (after local midnight) at which the elevation crosses `el` going down, by bisection between a and b.
export function crossing(place, date, el, a, b, utcOffsetMin = 120) {
  const f = (m) => solarPosition(place, date, m, utcOffsetMin).el - el;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    if ((f(a) > 0) === (f(mid) > 0)) a = mid; else b = mid;
  }
  return (a + b) / 2;
}
