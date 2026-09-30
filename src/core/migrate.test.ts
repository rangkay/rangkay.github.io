import { describe, expect, it } from 'vitest';
import { loadStored, migrateBoard } from './migrate';
import { QUERY_SCHEMA_VERSION } from './query';

/** A dashboard as the v1 prototype saved it: one lini filter, cards without filters/follow. */
const V1_BOARD = {
  id: 'b-old',
  name: 'Ringkasan lama',
  tag: 'Produksi',
  filters: { period: 'd7', lini: 'Lini 2' },
  pages: [{ id: 'p1', name: 'Ringkasan' }],
  page: 'p1',
  cards: [
    { id: 'c1', page: 'p1', q: { measure: 'output', agg: 'sum', group: 'lini', split: 'shift', period: 'dash', rule: null }, type: 'sbar', auto: true, title: '', span: 8, h: 320 },
    { id: 'c2', page: 'p1', q: { measure: 'oee', agg: 'sum', group: 'none', split: 'none', period: 'dash', rule: { op: 'lt', value: 75, tone: 'danger' } }, type: 'gauge', auto: true, title: '', span: 4, h: 320 },
  ],
  updatedAt: 1790000000000,
};

describe('schema v1 → v2', () => {
  it('turns the single lini filter into a dims list', () => {
    const r = migrateBoard(V1_BOARD)!;
    expect(r.migrated).toBe(true);
    expect(r.tooNew).toBe(false);
    expect(r.board.filters).toEqual({ period: 'd7', dims: [{ dim: 'lini', values: ['Lini 2'] }] });
  });

  it('maps "Semua" to an empty values list (all)', () => {
    const r = migrateBoard({ ...V1_BOARD, filters: { period: 'd30', lini: 'Semua' } })!;
    expect(r.board.filters.dims).toEqual([{ dim: 'lini', values: [] }]);
  });

  it('gives cards empty filters, follow on, and the current schema version', () => {
    const { board } = migrateBoard(V1_BOARD)!;
    board.cards.forEach((c) => {
      expect(c.q.filters).toEqual([]);
      expect(c.q.follow).toBe(true);
      expect(c.q.schemaVersion).toBe(QUERY_SCHEMA_VERSION);
    });
    // and still repairs invalid combinations (OEE cannot be summed)
    expect(board.cards[1].q.agg).toBe('avg');
    expect(board.cards[1].q.rule).toEqual({ op: 'lt', value: 75, tone: 'danger' });
  });

  it('is a no-op on an already migrated board', () => {
    const once = migrateBoard(V1_BOARD)!.board;
    const twice = migrateBoard(once)!;
    expect(twice.migrated).toBe(false);
    expect(twice.board).toEqual(once);
  });
});

describe('robustness', () => {
  it('keeps a card whose measure was removed', () => {
    const b = { ...V1_BOARD, cards: [{ ...V1_BOARD.cards[0], q: { ...V1_BOARD.cards[0].q, measure: 'energi', schemaVersion: 2 } }] };
    const r = migrateBoard(b)!;
    expect(r.board.cards).toHaveLength(1);
    expect(r.board.cards[0].q.measure).toBe('energi');
  });

  it('flags a board saved by a newer client', () => {
    const b = { ...V1_BOARD, cards: [{ ...V1_BOARD.cards[0], q: { ...V1_BOARD.cards[0].q, schemaVersion: QUERY_SCHEMA_VERSION + 1 } }] };
    expect(migrateBoard(b)!.tooNew).toBe(true);
    expect(loadStored({ v: 2, boards: [b] })!.readOnly).toEqual(['b-old']);
  });

  it('repairs broken pages, types and sizes', () => {
    const r = migrateBoard({ name: 'x', cards: [{ q: { measure: 'output', group: 'day' }, type: 'nope', span: 99, h: 5, page: 'gone' }] })!;
    const c = r.board.cards[0];
    expect(r.board.pages).toEqual([{ id: 'p1', name: 'Ringkasan' }]);
    expect(c.page).toBe('p1');
    expect(c.type).toBe('line');
    expect(c.span).toBe(12);
    expect(c.h).toBe(140);
  });

  it('ignores garbage', () => {
    expect(migrateBoard(null)).toBeNull();
    expect(loadStored({ v: 2, boards: 'x' })).toBeNull();
    expect(loadStored({ v: 2, boards: [1, 'a'] })).toBeNull();
  });
});
