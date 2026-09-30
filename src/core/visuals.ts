/**
 * Chart choice is driven by the shape of the result: one number, a time series, categories,
 * or categories with a split. `recommend` gives three suggestions; `unsuitable` explains why
 * a type does not fit. The two must never disagree (enforced by tests).
 */
import { GROUPS, MEASURES } from './semantic';
import type { Query, VisualType } from './types';

export const TYPES: [VisualType, string, string][] = [
  ['kpi', 'Kartu KPI', 'Sorotan angka'], ['bignum', 'Angka besar', 'Sorotan angka'], ['gauge', 'Gauge', 'Sorotan angka'], ['bullet', 'Bullet vs target', 'Sorotan angka'],
  ['bar', 'Bar', 'Perbandingan'], ['hbar', 'Bar horizontal', 'Perbandingan'], ['sbar', 'Bar bertumpuk', 'Perbandingan'], ['combo', 'Bar + garis', 'Perbandingan'], ['waterfall', 'Waterfall', 'Perbandingan'],
  ['line', 'Garis', 'Tren waktu'], ['area', 'Area', 'Tren waktu'],
  ['pie', 'Donut', 'Porsi dari total'], ['rose', 'Rose', 'Porsi dari total'], ['treemap', 'Treemap', 'Porsi dari total'], ['funnel', 'Funnel', 'Porsi dari total'],
  ['scatter', 'Titik', 'Sebaran'], ['bubble', 'Gelembung', 'Sebaran'], ['radar', 'Radar', 'Sebaran'], ['heat', 'Heatmap', 'Sebaran'], ['boxplot', 'Box plot', 'Sebaran'],
  ['table', 'Tabel', 'Detail'],
];

export const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t[0], t[1]])) as Record<VisualType, string>;
export const TYPE_IDS = TYPES.map((t) => t[0]);

export function isVisualType(t: unknown): t is VisualType {
  return typeof t === 'string' && (TYPE_IDS as string[]).includes(t);
}

/** Types that show a single number. */
export const SINGLE: Partial<Record<VisualType, true>> = { kpi: true, bignum: true, gauge: true };
/** Types that support a colour warning rule. */
export const RULEABLE: Partial<Record<VisualType, true>> = { kpi: true, bignum: true, gauge: true, bullet: true };
/** Types whose bars or slices can be clicked to cross-highlight. */
export const CLICKABLE: Partial<Record<VisualType, true>> = {
  bar: true, hbar: true, sbar: true, pie: true, rose: true, treemap: true, funnel: true, waterfall: true, combo: true, scatter: true, bubble: true,
};

export const REASON: Partial<Record<VisualType, string>> = {
  kpi: 'Satu angka penting plus arah trennya', bignum: 'Angka besar, tanpa gangguan', gauge: 'Posisi nilai terhadap batas maksimum', bullet: 'Bandingkan langsung dengan target',
  line: 'Paling jelas untuk naik-turun dari waktu ke waktu', area: 'Tren waktu dengan penekanan volume', bar: 'Paling mudah membandingkan antar kategori',
  hbar: 'Enak dibaca kalau nama kategorinya panjang', pie: 'Menunjukkan porsi tiap bagian dari total', sbar: 'Lihat total dan rinciannya sekaligus',
  heat: 'Pola dua dimensi dalam sekali pandang', table: 'Angka persis untuk dicek satu per satu', radar: 'Profil beberapa kategori sekaligus',
};

export type ResultShape = 'single' | 'time' | 'cat' | 'cat-split' | 'time-split';

export function shapeOf(q: Query): ResultShape {
  const kind = GROUPS[q.group]?.kind ?? 'none';
  const split = q.split !== 'none';
  if (kind === 'none') return 'single';
  if (kind === 'time') return split ? 'time-split' : 'time';
  return split ? 'cat-split' : 'cat';
}

export function recommend(q: Query): VisualType[] {
  const m = MEASURES[q.measure];
  const pct = !!m?.pct;
  switch (shapeOf(q)) {
    case 'single': return pct ? ['gauge', 'kpi', 'bullet'] : ['kpi', 'bignum', 'bullet'];
    case 'time-split': return ['line', 'sbar', 'area'];
    case 'time': return ['line', 'area', 'bar'];
    case 'cat-split': return ['sbar', 'heat', 'table'];
    default: return pct || q.agg !== 'sum' ? ['bar', 'hbar', 'radar'] : ['bar', 'pie', 'hbar'];
  }
}

const PORTION: Partial<Record<VisualType, true>> = { pie: true, rose: true, treemap: true, funnel: true, waterfall: true };
const NOT_FOR_TIME: Partial<Record<VisualType, true>> = { pie: true, rose: true, treemap: true, funnel: true, radar: true };

/** Empty string when the type fits, otherwise the reason it does not ("kurang pas"). */
export function unsuitable(t: VisualType, q: Query): string {
  const m = MEASURES[q.measure];
  const kind = GROUPS[q.group]?.kind ?? 'none';
  const none = kind === 'none';
  const time = kind === 'time';
  const summable = !!m && !m.pct && (q.agg === 'sum' || q.agg === 'count');
  if (none && !SINGLE[t] && t !== 'bullet' && t !== 'table') return 'butuh pengelompokan, misalnya per lini';
  if (!none && SINGLE[t]) return 'hanya menampilkan satu angka total, rinciannya hilang';
  if (PORTION[t] && !summable) return 'porsi hanya bermakna untuk nilai yang dijumlahkan';
  if (NOT_FOR_TIME[t] && time) return 'data waktu lebih mudah dibaca sebagai garis';
  if (t === 'bullet' && time) return 'terlalu banyak baris untuk data waktu';
  if ((t === 'sbar' || t === 'heat') && q.split === 'none') return 'pilih rincian (misalnya per shift) dulu';
  return '';
}
