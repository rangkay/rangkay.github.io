import { normQ, type QueryInput } from './query';
import { defaultSize, MAX_CARDS_PER_PAGE } from './layout';
import { recommend } from './visuals';
import { DEFAULT_PERIOD } from './semantic';
import type { Board, Card, IconName, Tone, VisualType } from './types';

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1296;
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3) + counter.toString(36);
}

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export function mkCard(q: QueryInput, type?: VisualType | null, span?: number, h?: number, page = 'p1'): Card {
  const nq = normQ({ measure: 'output', agg: 'sum', group: 'none', split: 'none', period: 'dash', rule: null, ...q });
  const t = type || recommend(nq)[0];
  const sz = defaultSize(t);
  return { id: uid(), page, q: nq, type: t, auto: true, title: '', span: span || sz[0], h: h || sz[1] };
}

export interface Template {
  label: string;
  desc: string;
  tag: string;
  tone: Tone;
  icon: IconName;
  cards: () => Card[];
}

export const TEMPLATES: Record<string, Template> = {
  oee: {
    label: 'OEE harian', desc: 'Output, OEE, dan reject per lini', tag: 'Produksi', tone: 'blue', icon: 'gauge',
    cards: () => [
      mkCard({ measure: 'output' }, 'kpi', 3, 176),
      mkCard({ measure: 'oee', agg: 'avg', rule: { op: 'lt', value: 75, tone: 'danger' } }, 'kpi', 3, 176),
      mkCard({ measure: 'reject_rate', agg: 'avg', rule: { op: 'gt', value: 3, tone: 'danger' } }, 'kpi', 3, 176),
      mkCard({ measure: 'pallet' }, 'kpi', 3, 176),
      mkCard({ measure: 'output', group: 'lini', split: 'shift' }, 'sbar', 8, 320),
      mkCard({ measure: 'oee', agg: 'avg' }, 'gauge', 4, 320),
      mkCard({ measure: 'reject', group: 'day' }, 'line', 12, 290),
    ],
  },
  qc: {
    label: 'Defect QC', desc: 'Jenis defect dan tingkat reject', tag: 'QC', tone: 'red', icon: 'alert',
    cards: () => [
      mkCard({ measure: 'defect' }, 'kpi', 4, 176),
      mkCard({ measure: 'reject_rate', agg: 'avg', rule: { op: 'gt', value: 3, tone: 'danger' } }, 'kpi', 4, 176),
      mkCard({ measure: 'defect', agg: 'count' }, 'kpi', 4, 176),
      mkCard({ measure: 'defect', group: 'defect' }, 'pie', 5, 320),
      mkCard({ measure: 'reject_rate', agg: 'avg', group: 'lini' }, 'bar', 7, 320),
      mkCard({ measure: 'reject_rate', agg: 'avg', group: 'day' }, 'line', 12, 290),
    ],
  },
  wms: {
    label: 'Okupansi gudang', desc: 'Pallet dan lead time per gudang', tag: 'Gudang', tone: 'amber', icon: 'box',
    cards: () => [
      mkCard({ measure: 'pallet' }, 'kpi', 6, 176),
      mkCard({ measure: 'lead', agg: 'avg' }, 'kpi', 6, 176),
      mkCard({ measure: 'pallet', group: 'gudang' }, 'hbar', 7, 300),
      mkCard({ measure: 'lead', agg: 'avg', group: 'gudang' }, 'bullet', 5, 300),
      mkCard({ measure: 'pallet', group: 'day' }, 'area', 12, 280),
    ],
  },
  blank: { label: 'Kosong', desc: 'Mulai dari nol dengan satu pertanyaan', tag: 'Umum', tone: 'violet', icon: 'sparkle', cards: () => [] },
};

export const TAG_COLORS: Record<string, string> = { Produksi: '#3B82F6', QC: '#EF4444', Gudang: '#F59E0B', Umum: '#8B5CF6' };

export const STARTERS: { label: string; q: QueryInput }[] = [
  { label: 'Output per lini', q: { measure: 'output', agg: 'sum', group: 'lini' } },
  { label: 'Tren reject harian', q: { measure: 'reject', agg: 'sum', group: 'day' } },
  { label: 'OEE rata-rata', q: { measure: 'oee', agg: 'avg', group: 'none' } },
  { label: 'Defect per jenis', q: { measure: 'defect', agg: 'sum', group: 'defect' } },
  { label: 'Pallet per gudang', q: { measure: 'pallet', agg: 'sum', group: 'gudang' } },
];

export const CONNECTORS: [string, string][] = [
  ['PostgreSQL', 'Database produksi (MES, ERP)'],
  ['Google Sheet', 'Tautkan spreadsheet yang sudah ada'],
  ['REST API', 'Sistem lain lewat endpoint'],
  ['CSV / SFTP', 'File yang dikirim terjadwal'],
  ['Directus', 'Instance Directus yang sudah jalan'],
  ['Node-RED', 'Data mesin lewat flow'],
];

export function mkBoard(name: string, tplKey: string, agoMs = 0, now = Date.now()): Board {
  const t = TEMPLATES[tplKey] ?? TEMPLATES.blank;
  return {
    id: uid(), name, tag: t.tag,
    filters: { period: DEFAULT_PERIOD, dims: [{ dim: 'lini', values: [] }] },
    pages: [{ id: 'p1', name: 'Ringkasan' }], page: 'p1',
    cards: t.cards(), updatedAt: now - agoMs,
  };
}

export function seedBoards(now = Date.now()): Board[] {
  return [
    mkBoard('Ringkasan operasi', 'oee', 2 * 3600e3, now),
    mkBoard('QC harian', 'qc', 26 * 3600e3, now),
    mkBoard('Okupansi gudang', 'wms', 4 * 86400e3, now),
  ];
}

export function pageCards(b: Board, pageId = b.page): Card[] {
  return b.cards.filter((c) => c.page === pageId);
}

/**
 * Where a new card goes: the current page, or a fresh page when it already holds
 * MAX_CARDS_PER_PAGE visuals. Mutates the board (adds the page) and returns the page id.
 */
export function pageForNewCard(b: Board): { pageId: string; created: boolean } {
  if (pageCards(b).length < MAX_CARDS_PER_PAGE) return { pageId: b.page, created: false };
  const id = 'p' + uid();
  b.pages.push({ id, name: 'Halaman ' + (b.pages.length + 1) });
  b.page = id;
  return { pageId: id, created: true };
}
