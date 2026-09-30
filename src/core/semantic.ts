/**
 * Semantic layer: the official list of measures and dimensions, with the combinations
 * that are allowed. Every sentence the composer can form is derived from this module,
 * so an invalid combination can never be offered. Labels are product text in Indonesian.
 */
import type { Agg, CardPeriod, DashPeriod, GroupKind, IconName, Tone } from './types';

export interface Measure {
  id: string;
  label: string;
  /** lower-case label used inside the sentence */
  lower: string;
  unit: string;
  /** percentages cannot be summed */
  pct?: boolean;
  /** show one decimal */
  dec?: boolean;
  def: Agg;
  aggs: Agg[];
  /** sample-data baseline */
  base: number;
  src: string;
  icon: IconName;
  tone: Tone;
  /** which direction is good, used for delta colouring and default rules */
  good: 'up' | 'down';
  target?: number;
}

export interface Group {
  label: string;
  kind: GroupKind;
  cats?: string[];
  noun?: string;
}

export interface Dimension {
  label: string;
  lower: string;
  values: string[];
}

export interface Source {
  groups: string[];
  splits: string[];
  dims: string[];
}

export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const LINI = ['Lini 1', 'Lini 2', 'Lini 3', 'Lini 4', 'Lini 5'];
const SHIFT = ['Shift 1', 'Shift 2', 'Shift 3'];
const DEFECT = ['Goresan', 'Dimensi', 'Kontaminasi', 'Label', 'Retak', 'Warna'];
const GUDANG = ['GD-A', 'GD-B', 'GD-C', 'GD-D'];

export const MEASURES: Record<string, Measure> = {
  output: { id: 'output', label: 'Output produksi', lower: 'output produksi', unit: 'unit', def: 'sum', aggs: ['sum', 'avg', 'max', 'min', 'count'], base: 1800, src: 'MES Produksi', icon: 'box', tone: 'blue', good: 'up' },
  reject: { id: 'reject', label: 'Jumlah reject', lower: 'jumlah reject', unit: 'unit', def: 'sum', aggs: ['sum', 'avg', 'max', 'min', 'count'], base: 42, src: 'MES Produksi', icon: 'alert', tone: 'red', good: 'down' },
  oee: { id: 'oee', label: 'OEE', lower: 'OEE', unit: '%', pct: true, def: 'avg', aggs: ['avg', 'max', 'min'], base: 76, src: 'MES Produksi', icon: 'gauge', tone: 'green', good: 'up', target: 85 },
  reject_rate: { id: 'reject_rate', label: 'Tingkat reject', lower: 'tingkat reject', unit: '%', pct: true, def: 'avg', aggs: ['avg', 'max', 'min'], base: 2.4, src: 'QC Log', icon: 'alert', tone: 'red', good: 'down' },
  defect: { id: 'defect', label: 'Qty defect', lower: 'qty defect', unit: 'pcs', def: 'sum', aggs: ['sum', 'avg', 'max', 'min', 'count'], base: 120, src: 'QC Log', icon: 'layers', tone: 'violet', good: 'down' },
  pallet: { id: 'pallet', label: 'Pallet tersimpan', lower: 'pallet tersimpan', unit: 'pallet', def: 'sum', aggs: ['sum', 'avg', 'max', 'min'], base: 640, src: 'WMS Gudang', icon: 'box', tone: 'amber', good: 'up' },
  lead: { id: 'lead', label: 'Lead time', lower: 'lead time', unit: 'jam', dec: true, def: 'avg', aggs: ['avg', 'max', 'min'], base: 18, src: 'WMS Gudang', icon: 'clock', tone: 'violet', good: 'down' },
};

export const AGGS: Record<Agg, string> = { sum: 'Total', avg: 'Rata-rata', max: 'Tertinggi', min: 'Terendah', count: 'Jumlah catatan' };

export const GROUPS: Record<string, Group> = {
  none: { label: 'secara keseluruhan', kind: 'none' },
  day: { label: 'per hari', kind: 'time' },
  month: { label: 'per bulan', kind: 'time' },
  lini: { label: 'per lini', kind: 'cat', cats: LINI, noun: 'Lini' },
  shift: { label: 'per shift', kind: 'cat', cats: SHIFT, noun: 'Shift' },
  defect: { label: 'per jenis defect', kind: 'cat', cats: DEFECT, noun: 'Jenis defect' },
  gudang: { label: 'per gudang', kind: 'cat', cats: GUDANG, noun: 'Gudang' },
};

export const SPLITS: Record<string, string> = { none: 'tanpa rincian', shift: 'dirinci per shift', lini: 'dirinci per lini' };

export const PERIODS: Record<CardPeriod, string> = {
  dash: 'periode dashboard', d7: '7 hari terakhir', d30: '30 hari terakhir', q: 'kuartal ini', y: 'tahun ini',
};
export const DASH_PERIODS: [DashPeriod, string][] = [['d7', '7 hari terakhir'], ['d30', '30 hari terakhir'], ['q', 'kuartal ini'], ['y', 'tahun ini']];
export const PERIOD_DAYS: Record<DashPeriod, number> = { d7: 7, d30: 30, q: 90, y: 365 };
export const DEFAULT_PERIOD: DashPeriod = 'd30';

export const DIMS: Record<string, Dimension> = {
  lini: { label: 'Lini', lower: 'lini', values: LINI },
  shift: { label: 'Shift', lower: 'shift', values: SHIFT },
  defect: { label: 'Jenis defect', lower: 'jenis defect', values: DEFECT },
  gudang: { label: 'Gudang', lower: 'gudang', values: GUDANG },
};

export const SOURCES: Record<string, Source> = {
  'MES Produksi': { groups: ['none', 'day', 'month', 'lini', 'shift'], splits: ['none', 'shift', 'lini'], dims: ['lini', 'shift'] },
  'QC Log': { groups: ['none', 'day', 'month', 'lini', 'defect'], splits: ['none', 'lini'], dims: ['lini', 'defect'] },
  'WMS Gudang': { groups: ['none', 'day', 'month', 'gudang'], splits: ['none'], dims: ['gudang'] },
};

export function isKnownMeasure(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(MEASURES, id);
}

export function sourceDims(measureId: string): string[] {
  const m = MEASURES[measureId];
  return m ? SOURCES[m.src].dims : [];
}

/** Sources that own a filterable dimension, e.g. lini → MES Produksi, QC Log. */
export function sourcesWithDim(dim: string): string[] {
  return Object.keys(SOURCES).filter((s) => SOURCES[s].dims.includes(dim));
}

/* ------------------------------------------------------------------ */
/* GET /v1/catalog — the contract the composer renders its choices from */
/* ------------------------------------------------------------------ */

export interface CatalogMeasure {
  id: string;
  label: string;
  source: string;
  aggs: Agg[];
  groups: string[];
  splits: string[];
  filterable: string[];
}

export interface CatalogDimension {
  id: string;
  label: string;
  cardinality: number;
  /** null when the dimension is too large to list; use `lookup` instead */
  values: string[] | null;
  lookup?: string;
}

export interface Catalog {
  measures: CatalogMeasure[];
  dimensions: CatalogDimension[];
}

/** Dimensions above this many values switch from a checklist to a search box. */
export const CHECKLIST_LIMIT = 50;

export function getCatalog(): Catalog {
  return {
    measures: Object.values(MEASURES).map((m) => ({
      id: m.id,
      label: m.label,
      source: m.src,
      aggs: [...m.aggs],
      groups: [...SOURCES[m.src].groups],
      splits: [...SOURCES[m.src].splits],
      filterable: [...SOURCES[m.src].dims],
    })),
    dimensions: Object.entries(DIMS).map(([id, d]) => ({
      id,
      label: d.label,
      cardinality: d.values.length,
      values: d.values.length <= CHECKLIST_LIMIT ? [...d.values] : null,
      ...(d.values.length > CHECKLIST_LIMIT ? { lookup: `/v1/dimensions/${id}/values` } : {}),
    })),
  };
}
