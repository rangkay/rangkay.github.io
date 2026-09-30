/**
 * Saved dashboards are migrated when they are opened, so a change in the query shape
 * never breaks what people already built.
 *
 *  v1: dashboard filter is a single `lini` ("Semua" or a line name); cards have no filters/follow.
 *  v2: dashboard has a `dims` list; cards have `filters` and `follow`.
 *
 * Rules: migration only adds fields with defaults; a card whose measure was removed is kept
 * (and shown as unavailable); a dashboard saved by a newer client is opened read-only.
 */
import { clamp } from './format';
import { COLS, defaultSize, MAX_H, MIN_H } from './layout';
import { normQ, QUERY_SCHEMA_VERSION } from './query';
import { DEFAULT_PERIOD, DIMS, PERIOD_DAYS } from './semantic';
import { isVisualType, recommend } from './visuals';
import { uid } from './board';
import type { Board, Card, DashPeriod, DimFilter, Page, SourceStatus } from './types';

export interface MigratedBoard {
  board: Board;
  /** true when anything had to be upgraded */
  migrated: boolean;
  /** true when the board was saved by a newer client; do not save over it */
  tooNew: boolean;
}

type Raw = Record<string, unknown>;
const isObj = (x: unknown): x is Raw => !!x && typeof x === 'object' && !Array.isArray(x);

function migrateFilters(f: unknown): { filters: Board['filters']; migrated: boolean } {
  const o = isObj(f) ? f : {};
  const period = (o.period as DashPeriod) in PERIOD_DAYS ? (o.period as DashPeriod) : DEFAULT_PERIOD;
  if (!Array.isArray(o.dims)) {
    // v1: { period, lini: 'Semua' | 'Lini 2' }
    const lini = typeof o.lini === 'string' && o.lini !== 'Semua' && DIMS.lini.values.includes(o.lini) ? [o.lini] : [];
    return { filters: { period, dims: [{ dim: 'lini', values: lini }] }, migrated: true };
  }
  const seen = new Set<string>();
  const dims: DimFilter[] = [];
  o.dims.forEach((d) => {
    if (!isObj(d) || typeof d.dim !== 'string' || !(d.dim in DIMS) || seen.has(d.dim)) return;
    seen.add(d.dim);
    const vals = Array.isArray(d.values) ? d.values.map(String) : [];
    const kept = DIMS[d.dim].values.filter((v) => vals.includes(v));
    dims.push({ dim: d.dim, values: kept.length === DIMS[d.dim].values.length ? [] : kept });
  });
  return { filters: { period, dims }, migrated: false };
}

function migrateCard(c: unknown, pageIds: string[], fallbackPage: string): { card: Card; migrated: boolean; tooNew: boolean } | null {
  if (!isObj(c) || !isObj(c.q)) return null;
  const rawQ = c.q;
  const version = Number(rawQ.schemaVersion) || 1;
  const tooNew = version > QUERY_SCHEMA_VERSION;
  const migrated = version < QUERY_SCHEMA_VERSION;
  const q = normQ(migrated ? { ...rawQ, schemaVersion: QUERY_SCHEMA_VERSION, filters: rawQ.filters ?? [], follow: rawQ.follow ?? true } : rawQ);
  const type = isVisualType(c.type) ? c.type : recommend(q)[0];
  const sz = defaultSize(type);
  const span = Number(c.span);
  const h = Number(c.h);
  return {
    card: {
      id: typeof c.id === 'string' && c.id ? c.id : uid(),
      page: typeof c.page === 'string' && pageIds.includes(c.page) ? c.page : fallbackPage,
      q,
      type,
      auto: c.auto !== false || !c.title,
      title: typeof c.title === 'string' ? c.title : '',
      span: Number.isFinite(span) ? clamp(Math.round(span), 1, COLS) : sz[0],
      h: Number.isFinite(h) ? clamp(Math.round(h), MIN_H, MAX_H) : sz[1],
    },
    migrated,
    tooNew,
  };
}

export function migrateBoard(raw: unknown): MigratedBoard | null {
  if (!isObj(raw)) return null;
  const f = migrateFilters(raw.filters);
  const pages: Page[] = (Array.isArray(raw.pages) ? raw.pages : [])
    .filter((p): p is Raw => isObj(p) && typeof p.id === 'string')
    .map((p) => ({ id: p.id as string, name: typeof p.name === 'string' && p.name ? p.name : 'Halaman' }));
  if (!pages.length) pages.push({ id: 'p1', name: 'Ringkasan' });
  const pageIds = pages.map((p) => p.id);
  let migrated = f.migrated;
  let tooNew = false;
  const cards: Card[] = [];
  (Array.isArray(raw.cards) ? raw.cards : []).forEach((c) => {
    const r = migrateCard(c, pageIds, pages[0].id);
    if (!r) return;
    migrated = migrated || r.migrated;
    tooNew = tooNew || r.tooNew;
    cards.push(r.card);
  });
  const board: Board = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Dashboard tanpa nama',
    tag: typeof raw.tag === 'string' ? raw.tag : 'Umum',
    filters: f.filters,
    pages,
    page: typeof raw.page === 'string' && pageIds.includes(raw.page) ? raw.page : pages[0].id,
    cards,
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
  return { board, migrated, tooNew };
}

export const STORE_VERSION = 2;

export interface StoredState {
  v: number;
  boards: Board[];
  sources?: SourceStatus[];
}

export interface LoadedState {
  boards: Board[];
  sources: SourceStatus[] | null;
  /** ids of boards saved by a newer client (open read-only) */
  readOnly: string[];
}

/** Parse the persisted envelope; returns null when there is nothing usable. */
export function loadStored(raw: unknown): LoadedState | null {
  if (!isObj(raw) || !Array.isArray(raw.boards)) return null;
  const readOnly: string[] = [];
  const boards: Board[] = [];
  raw.boards.forEach((b) => {
    const m = migrateBoard(b);
    if (!m) return;
    if (m.tooNew) readOnly.push(m.board.id);
    boards.push(m.board);
  });
  if (!boards.length) return null;
  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter((s): s is SourceStatus => isObj(s) && typeof s.name === 'string' && ['ok', 'warn', 'err'].includes(String(s.status)))
    : null;
  return { boards, sources, readOnly };
}
