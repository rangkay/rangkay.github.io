import { beforeEach, describe, expect, it } from 'vitest';
import { mkBoard, mkCard } from '../core/board';
import { MAX_CARDS_PER_PAGE } from '../core/layout';
import {
  __reset, addFilterDim, addPage, addStarter, applyStarter, closeComposer, commitComposer, createBoard, currentBoard, deleteCard, deletePage,
  duplicateCard, moveCard, openBoard, openComposer, openNewBoard, pickTemplate, redo, removeFilterDim, resizeCard, setComposerTitle,
  setComposerType, setDefaultFilters, setMode, setQ, setRole, undo, useStore,
} from './store';

function setup() {
  const b = mkBoard('Uji', 'oee');
  __reset({ boards: [b] });
  openBoard(b.id);
  setMode('edit');
  return b;
}

const board = () => currentBoard()!;

describe('history', () => {
  beforeEach(setup);

  it('undoes and redoes a delete', () => {
    const id = board().cards[0].id;
    deleteCard(id);
    expect(board().cards.some((c) => c.id === id)).toBe(false);
    expect(useStore.getState().toast?.undo).toBe(true);
    undo();
    expect(board().cards[0].id).toBe(id);
    redo();
    expect(board().cards.some((c) => c.id === id)).toBe(false);
  });

  it('clears redo after a new change', () => {
    deleteCard(board().cards[0].id);
    undo();
    duplicateCard(board().cards[0].id);
    expect(useStore.getState().redo).toHaveLength(0);
  });

  it('adding and removing a dashboard filter can be undone', () => {
    addFilterDim('shift');
    expect(board().filters.dims.map((d) => d.dim)).toEqual(['lini', 'shift']);
    removeFilterDim('lini');
    expect(board().filters.dims.map((d) => d.dim)).toEqual(['shift']);
    undo();
    undo();
    expect(board().filters.dims.map((d) => d.dim)).toEqual(['lini']);
  });

  it('changing default filter values is not an undo step', () => {
    setDefaultFilters({ period: 'd7', dims: [{ dim: 'lini', values: ['Lini 2'] }] });
    expect(board().filters.period).toBe('d7');
    expect(useStore.getState().undo).toHaveLength(0);
  });
});

describe('editing the layout', () => {
  beforeEach(setup);

  it('reorders cards', () => {
    const [a, b, c] = board().cards.map((x) => x.id);
    moveCard(c, a, true);
    expect(board().cards.slice(0, 3).map((x) => x.id)).toEqual([c, a, b]);
  });

  it('resizes and records one history step', () => {
    const c = board().cards[0];
    resizeCard(c.id, 6, 240);
    expect(board().cards[0]).toMatchObject({ span: 6, h: 240 });
    expect(useStore.getState().undo).toHaveLength(1);
  });

  it('deleting a page removes its visuals and can be undone', () => {
    addPage();
    const pid = board().page;
    addStarter(0);
    expect(board().cards.filter((c) => c.page === pid)).toHaveLength(1);
    deletePage(pid);
    expect(board().pages.some((p) => p.id === pid)).toBe(false);
    expect(board().cards.some((c) => c.page === pid)).toBe(false);
    undo();
    expect(board().cards.filter((c) => c.page === pid)).toHaveLength(1);
  });

  it('opens a new page once the current one holds the maximum', () => {
    useStore.setState((s) => ({
      boards: s.boards.map((b) => ({ ...b, cards: Array.from({ length: MAX_CARDS_PER_PAGE }, () => mkCard({ measure: 'output' })) })),
    }));
    addStarter(0);
    expect(board().pages).toHaveLength(2);
    expect(board().cards.filter((c) => c.page === board().page)).toHaveLength(1);
  });
});

describe('composer', () => {
  beforeEach(setup);

  it('re-validates the sentence and follows the recommendation', () => {
    openComposer(null);
    setQ('measure', 'oee');
    const C = useStore.getState().composer!;
    expect(C.q.agg).toBe('avg');
    expect(C.type).toBe('bar');
    setQ('group', 'none');
    expect(useStore.getState().composer!.type).toBe('gauge');
  });

  it('keeps a manual type while it still fits, and drops it when it does not', () => {
    openComposer(null);
    setComposerType('hbar');
    setQ('agg', 'max');
    expect(useStore.getState().composer!.type).toBe('hbar');
    setQ('group', 'none');
    expect(useStore.getState().composer!.type).toBe('kpi');
  });

  it('adds a visual with a custom title, and edits it back to automatic', () => {
    const before = board().cards.length;
    openComposer(null);
    applyStarter(3);
    setComposerTitle('Defect minggu ini');
    commitComposer();
    const added = board().cards[before];
    expect(added).toMatchObject({ title: 'Defect minggu ini', auto: false, type: 'bar' });
    expect(useStore.getState().toast?.msg).toBe('Visual ditambahkan ke dashboard');
    openComposer(added.id);
    setComposerTitle('');
    commitComposer();
    expect(board().cards[before]).toMatchObject({ auto: true, title: '' });
  });

  it('cancel changes nothing', () => {
    const snap = JSON.stringify(board());
    openComposer(board().cards[0].id);
    setQ('measure', 'lead');
    closeComposer();
    expect(JSON.stringify(board())).toBe(snap);
  });
});

describe('roles and read-only boards', () => {
  it('a reader cannot change the board', () => {
    setup();
    setRole('viewer');
    const n = board().cards.length;
    deleteCard(board().cards[0].id);
    openComposer(null);
    expect(board().cards).toHaveLength(n);
    expect(useStore.getState().composer).toBeNull();
    expect(useStore.getState().mode).toBe('view');
  });

  it('a board saved by a newer client stays read-only for editors', () => {
    const b = setup();
    useStore.setState({ readOnly: [b.id] });
    const n = board().cards.length;
    deleteCard(board().cards[0].id);
    expect(board().cards).toHaveLength(n);
  });

  it('creates a board from a template', () => {
    setup();
    openNewBoard();
    pickTemplate('wms');
    const id = createBoard()!;
    expect(useStore.getState().boards[0]).toMatchObject({ id, name: 'Okupansi gudang', tag: 'Gudang' });
    expect(useStore.getState().boards[0].cards).toHaveLength(5);
  });
});
