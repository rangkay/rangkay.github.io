import { MEASURES } from './semantic';
import type { Query } from './types';

export interface NumFormat {
  label: string;
  pct: boolean;
  unit: string;
  dec: boolean;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** FNV-1a, used to seed deterministic sample data. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-random number in [0,1) for a seed and index. */
export function rnd(seed: number, i: number): number {
  const x = Math.sin((seed % 100000) * 0.731 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function nf(v: number, d: number): string {
  return Number(v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

/** How a query's numbers are written: counting records changes the unit and drops decimals. */
export function fm(q: Query): NumFormat {
  const m = MEASURES[q.measure];
  const cnt = q.agg === 'count';
  if (!m) return { label: q.measure, pct: false, unit: '', dec: false };
  return { label: m.label, pct: !!m.pct && !cnt, unit: cnt ? 'catatan' : m.unit, dec: !!(m.dec || m.pct) && !cnt };
}

export function fmtNum(v: number | null | undefined, f: NumFormat, noUnit = false): string {
  if (v == null || Number.isNaN(v)) return '–';
  const s = nf(v, f.dec ? 1 : 0);
  if (f.pct) return s + '%';
  return noUnit || !f.unit ? s : s + ' ' + f.unit;
}

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return nf(v / 1e6, 1) + ' jt';
  if (a >= 1e4) return nf(v / 1e3, 0) + ' rb';
  if (a >= 1e3) return nf(v / 1e3, 1) + ' rb';
  return nf(v, a < 10 ? 1 : 0);
}

export function fmtDelta(d: number, f: NumFormat): string {
  return nf(Math.abs(d), 1) + (f.pct ? ' poin' : '%');
}

export function ago(ts: number, now = Date.now()): string {
  const s = (now - ts) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  return Math.floor(s / 86400) + ' hari lalu';
}

export function niceMax(v: number): number {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** "08.15" style clock label for data-age stamps. */
export function clock(d: Date): string {
  return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
}
