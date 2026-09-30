/**
 * Editor state: one Zustand store, with board snapshots as the undo history.
 * Every structural change goes through `mutate`, which records history and triggers autosave.
 */
import { create } from 'zustand';
import { clone, CONNECTORS, mkBoard, mkCard, pageCards, pageForNewCard, seedBoards, STARTERS, TEMPLATES, uid } from '../core/board';
import { ruleDefault } from '../core/engine';
import { defaultSize, fitHeight } from '../core/layout';
import { autoTitle, cardTitle, normQ, type QueryInput } from '../core/query';
import { DIMS, MEASURES } from '../core/semantic';
import { recommend, unsuitable } from '../core/visuals';
import { loadState, saveState } from './persist';
import type { Board, CrossHighlight, DashboardFilters, Query, Rule, SourceStatus, VisualType } from '../core/types';

export type Role = 'editor' | 'viewer';
export type Mode = 'view' | 'edit';
export type SaveState = 'saving' | 'saved' | 'session';

export interface ComposerState {
  cardId: string | null;
  q: Query;
  type: VisualType;
  /** the user picked the type; keep it unless it stops fitting */
  manualType: boolean;
  autoTitle: boolean;
  title: string;
  showAll: boolean;
}

export type Modal = { type: 'new'; tpl: string; name: string; touched: boolean } | { type: 'connect' };

export interface Toast {
  id: number;
  msg: string;
  undo: boolean;
}

const HISTORY_LIMIT = 80;
const SAVE_DELAY = 450;

export const DEFAULT_SOURCES: SourceStatus[] = [
  { name: 'MES Produksi', detail: 'PostgreSQL, 4 tabel', sync: 'Diperbarui tiap 15 menit', status: 'ok' },
  { name: 'QC Log', detail: 'Google Sheet, 1 lembar', sync: 'Diperbarui manual', status: 'warn' },
  { name: 'WMS Gudang', detail: 'REST API, 3 endpoint', sync: 'Diperbarui tiap jam', status: 'ok' },
  { name: 'SAP Extract', detail: 'CSV lewat SFTP', sync: 'Gagal sinkron 2 jam lalu', status: 'err' },
];

export interface AppState {
  role: Role;
  mode: Mode;
  dark: boolean;
  /** when the sample data is "as of" (fixed per session so numbers do not jump) */
  asOf: number;
  boards: Board[];
  sources: SourceStatus[];
  /** boards saved by a newer client: opened read-only */
  readOnly: string[];
  boardId: string | null;
  selected: string | null;
  cross: CrossHighlight | null;
  flash: string | null;
  composer: ComposerState | null;
  modal: Modal | null;
  toast: Toast | null;
  undo: string[];
  redo: string[];
  saveState: SaveState;
  renamingBoard: boolean;
  pageRename: string | null;
  search: string;
}

const initial: AppState = {
  role: 'editor', mode: 'view', dark: false, asOf: Date.now(),
  boards: [], sources: DEFAULT_SOURCES, readOnly: [], boardId: null,
  selected: null, cross: null, flash: null, composer: null, modal: null, toast: null,
  undo: [], redo: [], saveState: 'saved', renamingBoard: false, pageRename: null, search: '',
};

export const useStore = create<AppState>()(() => ({ ...initial }));

const get = useStore.getState;
const set = useStore.setState;

/* ------------------------------------------------------------------ */
/* selectors used by actions                                           */
/* ------------------------------------------------------------------ */

export function currentBoard(s: AppState = get()): Board | null {
  return s.boards.find((b) => b.id === s.boardId) ?? null;
}

export function canEdit(s: AppState = get()): boolean {
  return s.role === 'editor' && !(s.boardId && s.readOnly.includes(s.boardId));
}

/* ------------------------------------------------------------------ */
/* boot and autosave                                                   */
/* ------------------------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let flashTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

function scheduleSave() {
  set({ saveState: 'saving' });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = get();
    const writable = s.boards.filter((b) => !s.readOnly.includes(b.id));
    const kept = s.boards.filter((b) => s.readOnly.includes(b.id));
    // Boards from a newer client are written back untouched so their unknown fields survive.
    set({ saveState: saveState([...writable, ...kept], s.sources) ? 'saved' : 'session' });
  }, SAVE_DELAY);
}

export function boot(prefersDark: boolean): void {
  const loaded = loadState();
  if (loaded) {
    set({ boards: loaded.boards, sources: loaded.sources ?? DEFAULT_SOURCES, readOnly: loaded.readOnly, dark: prefersDark, asOf: Date.now() });
  } else {
    set({ boards: seedBoards(), sources: DEFAULT_SOURCES, dark: prefersDark, asOf: Date.now() });
    saveState(get().boards, get().sources);
  }
}

/* ------------------------------------------------------------------ */
/* history                                                             */
/* ------------------------------------------------------------------ */

function replaceBoard(boards: Board[], b: Board): Board[] {
  return boards.map((x) => (x.id === b.id ? b : x));
}

/** Apply a change to the open board. Undoable changes are recorded in history. */
export function mutate(fn: (b: Board) => void, undoable = true): void {
  const s = get();
  const b = currentBoard(s);
  if (!b || !canEdit(s)) return;
  const before = JSON.stringify(b);
  const next = JSON.parse(before) as Board;
  fn(next);
  next.updatedAt = Date.now();
  set({
    boards: replaceBoard(s.boards, next),
    undo: undoable ? [...s.undo, before].slice(-HISTORY_LIMIT) : s.undo,
    redo: undoable ? [] : s.redo,
  });
  scheduleSave();
}

function swapFromHistory(from: 'undo' | 'redo') {
  const s = get();
  const b = currentBoard(s);
  const stack = s[from];
  if (!b || !stack.length || !canEdit(s)) return false;
  const snap = JSON.parse(stack[stack.length - 1]) as Board;
  if (!snap.pages.some((p) => p.id === snap.page)) snap.page = snap.pages[0].id;
  snap.updatedAt = Date.now();
  const other = from === 'undo' ? 'redo' : 'undo';
  set({
    boards: replaceBoard(s.boards, snap),
    [from]: stack.slice(0, -1),
    [other]: [...s[other], JSON.stringify(b)],
    selected: s.selected && snap.cards.some((c) => c.id === s.selected) ? s.selected : null,
  } as Partial<AppState>);
  scheduleSave();
  return true;
}

export function undo(): void {
  if (swapFromHistory('undo')) toast('Perubahan terakhir dibatalkan');
}

export function redo(): void {
  if (swapFromHistory('redo')) toast('Perubahan dikembalikan');
}

/* ------------------------------------------------------------------ */
/* feedback                                                            */
/* ------------------------------------------------------------------ */

export function toast(msg: string, undoable = false): void {
  set({ toast: { id: ++toastSeq, msg, undo: undoable } });
}

export function dismissToast(id: number): void {
  if (get().toast?.id === id) set({ toast: null });
}

function flashCard(id: string) {
  set({ flash: id, selected: id });
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    if (get().flash === id) set({ flash: null });
  }, 1400);
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */

export function setRole(role: Role): void {
  set((s) => ({ role, mode: role === 'editor' ? s.mode : 'view', composer: role === 'editor' ? s.composer : null, selected: null }));
}

export function toggleTheme(): void {
  set((s) => ({ dark: !s.dark }));
}

export function setMode(mode: Mode): void {
  if (mode === 'edit' && !canEdit()) mode = 'view';
  set({ mode, selected: null, cross: null, renamingBoard: false, pageRename: null });
}

export function setSearch(search: string): void {
  set({ search });
}

/** Called when the route shows a board (or leaves one). */
export function openBoard(id: string | null): void {
  const s = get();
  if (s.boardId === id) return;
  const b = id ? s.boards.find((x) => x.id === id) : null;
  set({
    boardId: b ? b.id : null, mode: 'view', selected: null, cross: null, pageRename: null, renamingBoard: false,
    undo: [], redo: [], composer: null,
  });
}

/* ------------------------------------------------------------------ */
/* board                                                               */
/* ------------------------------------------------------------------ */

export function select(id: string | null): void {
  if (get().selected !== id) set({ selected: id });
}

export function setCross(c: CrossHighlight | null): void {
  set({ cross: c });
}

/** Editor sets the dashboard's default filter values (not part of undo, as in the prototype). */
export function setDefaultFilters(filters: DashboardFilters): void {
  set({ cross: null });
  mutate((b) => {
    b.filters = clone(filters);
  }, false);
}

export function addFilterDim(dim: string): void {
  if (!(dim in DIMS)) return;
  mutate((b) => {
    if (!b.filters.dims.some((f) => f.dim === dim)) b.filters.dims.push({ dim, values: [] });
  });
}

export function removeFilterDim(dim: string): void {
  mutate((b) => {
    b.filters.dims = b.filters.dims.filter((f) => f.dim !== dim);
  });
  toast('Filter ' + DIMS[dim].lower + ' dihapus', true);
}

export function renameBoard(name: string): void {
  const v = name.trim();
  set({ renamingBoard: false });
  const b = currentBoard();
  if (b && v && v !== b.name) mutate((x) => { x.name = v; });
}

export function startRenameBoard(): void {
  if (canEdit()) set({ renamingBoard: true });
}

export function cancelRename(): void {
  set({ renamingBoard: false, pageRename: null });
}

export function duplicateCard(id: string): void {
  const b = currentBoard();
  const c = b?.cards.find((x) => x.id === id);
  if (!b || !c) return;
  const n = clone(c);
  n.id = uid();
  if (!n.auto) n.title = n.title + ' (salinan)';
  mutate((x) => {
    const placed = pageForNewCard(x);
    n.page = placed.pageId;
    const i = x.cards.findIndex((y) => y.id === id);
    x.cards.splice(placed.created ? x.cards.length : i + 1, 0, n);
  });
  flashCard(n.id);
  toast('Visual diduplikat', true);
}

export function deleteCard(id: string): void {
  const c = currentBoard()?.cards.find((x) => x.id === id);
  if (!c) return;
  set({ selected: null });
  mutate((b) => {
    b.cards = b.cards.filter((x) => x.id !== id);
  });
  toast('“' + cardTitle(c) + '” dihapus', true);
}

export function addStarter(i: number): void {
  const s = STARTERS[i];
  const b = currentBoard();
  if (!s || !b) return;
  let card = mkCard(clone(s.q), null, undefined, undefined, b.page);
  set({ mode: 'edit' });
  mutate((x) => {
    card = { ...card, page: pageForNewCard(x).pageId };
    x.cards.push(card);
  });
  flashCard(card.id);
  toast('“' + cardTitle(card) + '” ditambahkan', true);
}

/** Reorder by dropping card `from` before or after card `to`. */
export function moveCard(from: string, to: string, before: boolean): void {
  if (from === to) return;
  mutate((b) => {
    const fi = b.cards.findIndex((c) => c.id === from);
    if (fi < 0) return;
    const [card] = b.cards.splice(fi, 1);
    const ti = b.cards.findIndex((c) => c.id === to);
    if (ti < 0) {
      b.cards.splice(fi, 0, card);
      return;
    }
    card.page = b.cards[ti].page;
    b.cards.splice(before ? ti : ti + 1, 0, card);
  });
}

export function moveCardToPage(id: string, pageId: string): void {
  const b = currentBoard();
  const pg = b?.pages.find((p) => p.id === pageId);
  if (!b || !pg) return;
  mutate((x) => {
    const c = x.cards.find((y) => y.id === id);
    if (c) c.page = pageId;
    x.page = pageId;
  });
  toast('Visual dipindah ke “' + pg.name + '”', true);
}

/** Commit a resize. `before` is the board snapshot from when the drag started. */
export function resizeCard(id: string, span: number, h: number): void {
  const c = currentBoard()?.cards.find((x) => x.id === id);
  if (!c || (c.span === span && c.h === h)) return;
  mutate((b) => {
    const x = b.cards.find((y) => y.id === id);
    if (x) {
      x.span = span;
      x.h = h;
    }
  });
  set({ selected: id });
}

export function addPage(): void {
  const b = currentBoard();
  if (!b) return;
  const id = 'p' + uid();
  mutate((x) => {
    x.pages.push({ id, name: 'Halaman ' + (x.pages.length + 1) });
    x.page = id;
  });
  set({ pageRename: id });
}

export function pickPage(id: string): void {
  const s = get();
  const b = currentBoard(s);
  if (!b || b.page === id || !b.pages.some((p) => p.id === id)) return;
  // Page choice is view state: never part of undo, and readers may switch pages too.
  set({ boards: replaceBoard(s.boards, { ...b, page: id }), selected: null, cross: null });
  if (canEdit(s)) scheduleSave();
}

export function deletePage(id: string): void {
  const b = currentBoard();
  if (!b || b.pages.length < 2) return;
  const p = b.pages.find((x) => x.id === id);
  if (!p) return;
  const n = pageCards(b, id).length;
  mutate((x) => {
    x.pages = x.pages.filter((y) => y.id !== id);
    x.cards = x.cards.filter((c) => c.page !== id);
    if (x.page === id) x.page = x.pages[0].id;
  });
  toast('Halaman “' + p.name + '” dihapus' + (n ? ' beserta ' + n + ' visual' : ''), true);
}

export function startRenamePage(id: string): void {
  if (canEdit()) set({ pageRename: id });
}

export function renamePage(name: string): void {
  const id = get().pageRename;
  set({ pageRename: null });
  const v = name.trim();
  const p = currentBoard()?.pages.find((x) => x.id === id);
  if (p && v && v !== p.name) mutate((b) => {
    const x = b.pages.find((y) => y.id === id);
    if (x) x.name = v;
  });
}

/* ------------------------------------------------------------------ */
/* composer                                                            */
/* ------------------------------------------------------------------ */

export function openComposer(cardId: string | null, q0?: QueryInput): void {
  const b = currentBoard();
  if (!b || !canEdit()) return;
  const c = cardId ? b.cards.find((x) => x.id === cardId) : null;
  const q = c ? clone(c.q) : normQ({ measure: 'output', agg: 'sum', group: 'lini', split: 'none', period: 'dash', rule: null, ...q0 });
  set({
    mode: 'edit',
    composer: {
      cardId: c ? c.id : null, q,
      type: c ? c.type : recommend(q)[0],
      manualType: !!c, autoTitle: c ? c.auto || !c.title : true, title: c ? c.title : '', showAll: false,
    },
  });
}

export function closeComposer(): void {
  set({ composer: null });
}

function updateComposer(fn: (c: ComposerState) => void) {
  const c = get().composer;
  if (!c) return;
  const next = clone(c);
  fn(next);
  set({ composer: next });
}

/** Change one word of the sentence and re-validate the whole query. */
export function setQ<K extends 'measure' | 'agg' | 'group' | 'split' | 'period'>(k: K, v: string): void {
  updateComposer((c) => {
    const raw: QueryInput = { ...c.q, [k]: v };
    if (k === 'measure') {
      raw.agg = MEASURES[v]?.def;
      raw.rule = null;
      raw.filters = [];
    }
    c.q = normQ(raw);
    if (!c.manualType || unsuitable(c.type, c.q)) {
      c.type = recommend(c.q)[0];
      c.manualType = false;
    }
  });
}

export function applyStarter(i: number): void {
  const s = STARTERS[i];
  if (!s) return;
  updateComposer((c) => {
    c.q = normQ({ split: 'none', period: 'dash', rule: null, ...clone(s.q) });
    c.manualType = false;
    c.type = recommend(c.q)[0];
  });
}

export function setComposerType(t: VisualType): void {
  updateComposer((c) => {
    c.type = t;
    c.manualType = true;
  });
}

export function toggleAllTypes(): void {
  updateComposer((c) => { c.showAll = !c.showAll; });
}

export function setComposerTitle(v: string): void {
  updateComposer((c) => {
    c.title = v;
    // Typing the automatic title back (or leaving the field empty on commit) returns to auto mode.
    c.autoTitle = v === autoTitle(c.q);
  });
}

export function resetAutoTitle(): void {
  updateComposer((c) => {
    c.autoTitle = true;
    c.title = '';
  });
}

export function setFollow(on: boolean): void {
  updateComposer((c) => { c.q.follow = on; });
}

export function setCardFilter(dim: string, values: string[]): void {
  updateComposer((c) => {
    const rest = c.q.filters.filter((f) => f.dim !== dim);
    c.q = normQ({ ...c.q, filters: values.length ? [...rest, { dim, values }] : rest });
  });
}

export function setRuleOn(on: boolean, filters: DashboardFilters): void {
  updateComposer((c) => {
    c.q.rule = on ? ruleDefault(c.q, filters, { asOf: new Date(get().asOf) }) : null;
  });
}

export function setRule(patch: Partial<Rule>): void {
  updateComposer((c) => {
    if (c.q.rule) c.q.rule = { ...c.q.rule, ...patch };
  });
}

export function commitComposer(): void {
  const s = get();
  const C = s.composer;
  const b = currentBoard(s);
  if (!C || !b) return;
  const title = C.autoTitle ? '' : C.title.trim();
  set({ composer: null });
  if (C.cardId) {
    const id = C.cardId;
    mutate((x) => {
      const c = x.cards.find((y) => y.id === id);
      if (!c) return;
      c.q = clone(C.q);
      c.type = C.type;
      c.auto = !title;
      c.title = title;
      c.h = fitHeight(c.type, c.h);
    });
    toast('Perubahan visual disimpan', true);
    return;
  }
  const sz = defaultSize(C.type);
  const card = { id: uid(), page: b.page, q: clone(C.q), type: C.type, auto: !title, title, span: sz[0], h: sz[1] };
  let created = false;
  mutate((x) => {
    const placed = pageForNewCard(x);
    card.page = placed.pageId;
    created = placed.created;
    x.cards.push(card);
  });
  flashCard(card.id);
  toast(created ? 'Visual ditambahkan ke halaman baru, karena halaman tadi sudah penuh' : 'Visual ditambahkan ke dashboard', true);
}

/* ------------------------------------------------------------------ */
/* modals: new dashboard, connect source                               */
/* ------------------------------------------------------------------ */

export function openNewBoard(): void {
  if (get().role !== 'editor') return;
  set({ modal: { type: 'new', tpl: 'oee', name: TEMPLATES.oee.label, touched: false } });
}

export function pickTemplate(tpl: string): void {
  const m = get().modal;
  if (m?.type !== 'new') return;
  set({ modal: { ...m, tpl, name: m.touched ? m.name : tpl === 'blank' ? 'Dashboard baru' : TEMPLATES[tpl].label } });
}

export function setNewBoardName(name: string): void {
  const m = get().modal;
  if (m?.type === 'new') set({ modal: { ...m, name, touched: true } });
}

/** Creates the board and returns its id so the caller can navigate to it. */
export function createBoard(): string | null {
  const m = get().modal;
  if (m?.type !== 'new') return null;
  const name = m.name.trim() || 'Dashboard baru';
  const b = mkBoard(name, m.tpl);
  set((s) => ({ boards: [b, ...s.boards], modal: null, boardId: b.id, mode: 'edit', undo: [], redo: [], selected: null, cross: null }));
  scheduleSave();
  toast('Dashboard “' + name + '” dibuat');
  return b.id;
}

export function openConnect(): void {
  if (get().role === 'editor') set({ modal: { type: 'connect' } });
}

export function pickConnector(i: number): void {
  const c = CONNECTORS[i];
  if (!c) return;
  set((s) => ({ sources: [{ name: c[0] + ' baru', detail: 'Tersambung (simulasi)', sync: 'Baru saja', status: 'ok' }, ...s.sources], modal: null }));
  scheduleSave();
  toast(c[0] + ' tersambung');
}

export function closeModal(): void {
  set({ modal: null });
}

/** For tests: reset to a clean state. */
export function __reset(state: Partial<AppState> = {}): void {
  clearTimeout(saveTimer);
  set({ ...initial, ...state });
}
