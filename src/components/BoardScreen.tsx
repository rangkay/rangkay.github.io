import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { pageCards, STARTERS } from '../core/board';
import { runQuery } from '../core/engine';
import { clock } from '../core/format';
import { effSpan, minSpan } from '../core/layout';
import { DASH_PERIODS, DEFAULT_PERIOD, DIMS, GROUPS, sourcesWithDim } from '../core/semantic';
import { filtersToParams } from '../core/urlFilters';
import { CLICKABLE } from '../core/visuals';
import type { Board, DashboardFilters, DashPeriod } from '../core/types';
import { useActiveFilters, useCanEdit } from '../store/selectors';
import {
  addFilterDim, addPage, addStarter, deletePage, moveCardToPage, openComposer, pickPage, removeFilterDim, renamePage, setCross,
  setDefaultFilters, startRenamePage, useStore,
} from '../store/store';
import { MenuButton, MultiPill, Pill } from './controls';
import { dragging } from './dnd';
import { useElementWidth, useViewportWidth } from './hooks';
import { Icon } from './Icon';
import { VisualCard } from './VisualCard';

function FilterLine({ board, filters, edit, onChange, onReset, showHint }: {
  board: Board;
  filters: DashboardFilters;
  edit: boolean;
  onChange: (f: DashboardFilters) => void;
  onReset: () => void;
  showHint: boolean;
}) {
  const cross = useStore((s) => s.cross);
  const asOf = useStore((s) => s.asOf);
  const have = board.filters.dims.map((f) => f.dim);
  const avail = Object.keys(DIMS).filter((d) => !have.includes(d));
  const dirty = filters.period !== DEFAULT_PERIOD || filters.dims.some((f) => f.values.length) || !!cross;

  return (
    <div className="filterline" role="region" aria-label="Filter dashboard">
      <span className="lead"><Icon name="filter" />Menampilkan data</span>
      <Pill small label="Periode" value={filters.period} options={DASH_PERIODS} onChange={(v) => onChange({ ...filters, period: v as DashPeriod })} />
      {filters.dims.map((f, i) => (
        <span key={f.dim} style={{ display: 'contents' }}>
          <span>{i === 0 ? 'untuk' : 'dan'}</span>
          <MultiPill
            dim={f.dim}
            values={f.values}
            onChange={(values) => onChange({ ...filters, dims: filters.dims.map((x) => (x.dim === f.dim ? { dim: f.dim, values } : x)) })}
            extra={edit && (
              <button type="button" className="fx" title={'Hapus filter ' + DIMS[f.dim].lower} aria-label={'Hapus filter ' + DIMS[f.dim].lower} onClick={() => removeFilterDim(f.dim)}>
                <Icon name="close" />
              </button>
            )}
          />
        </span>
      ))}
      {edit && avail.length > 0 && (
        <MenuButton label="Tambah filter" icon="plus">
          {(close) => avail.map((d) => (
            <button type="button" key={d} className="pop-add" role="menuitem" onClick={() => { close(); addFilterDim(d); }}>
              {DIMS[d].label}<small>Berlaku untuk {sourcesWithDim(d).join(', ')}</small>
            </button>
          ))}
        </MenuButton>
      )}
      {cross && (
        <span className="xchip">Disorot: {cross.value}
          <button type="button" title="Hapus sorotan" aria-label="Hapus sorotan" onClick={() => setCross(null)}><Icon name="close" /></button>
        </span>
      )}
      {dirty && <button type="button" className="link" onClick={onReset}>Atur ulang</button>}
      {showHint && <span className="hint-inline">Klik batang atau irisan grafik untuk menyorot</span>}
      <span className="asof"><span className="dotc" style={{ background: 'var(--success)' }} aria-hidden="true" />Data contoh per pukul {clock(new Date(asOf))}</span>
    </div>
  );
}

function PageTabs({ board, edit }: { board: Board; edit: boolean }) {
  const renaming = useStore((s) => s.pageRename);
  if (board.pages.length < 2 && !renaming) return null;
  return (
    <div className="pages" role="tablist" aria-label="Halaman dashboard">
      {board.pages.map((p) => renaming === p.id ? (
        <input key={p.id} className="page-input" defaultValue={p.name} maxLength={40} aria-label="Nama halaman" autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => renamePage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { e.preventDefault(); useStore.setState({ pageRename: null }); }
          }} />
      ) : (
        <button type="button" key={p.id} role="tab" aria-selected={board.page === p.id} className={'page' + (board.page === p.id ? ' on' : '')}
          title={edit ? 'Klik dua kali untuk mengganti nama' : undefined}
          onClick={() => pickPage(p.id)}
          onDoubleClick={edit ? () => startRenamePage(p.id) : undefined}
          onDragOver={edit ? (e) => { if (dragging.id) { e.preventDefault(); e.currentTarget.classList.add('drop'); } } : undefined}
          onDragLeave={edit ? (e) => e.currentTarget.classList.remove('drop') : undefined}
          onDrop={edit ? (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drop');
            const id = dragging.id;
            dragging.id = null;
            if (id) moveCardToPage(id, p.id);
          } : undefined}
        >
          {p.name}
          {edit && board.pages.length > 1 && (
            <span className="x" role="button" tabIndex={0} title="Hapus halaman" aria-label={'Hapus halaman ' + p.name}
              onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deletePage(p.id); } }}>
              <Icon name="close" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BoardScreen({ board }: { board: Board }) {
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selected);
  const flash = useStore((s) => s.flash);
  const cross = useStore((s) => s.cross);
  const asOf = useStore((s) => s.asOf);
  const readOnly = useStore((s) => s.readOnly.includes(board.id));
  const role = useStore((s) => s.role);
  const canEdit = useCanEdit();
  const edit = mode === 'edit' && canEdit;
  const { filters } = useActiveFilters();
  const [, setParams] = useSearchParams();
  const [gridRef, gw] = useElementWidth();
  const vw = useViewportWidth();
  const cards = useMemo(() => pageCards(board), [board]);

  // One request for every card on the page, like POST /v1/query.
  const results = useMemo(() => {
    const res = runQuery({ dashboardFilters: filters, cards: cards.map((c) => ({ id: c.id, query: c.q })) }, { asOf: new Date(asOf), cross });
    return new Map(res.map((r) => [r.id, r]));
  }, [cards, filters, cross, asOf]);

  /** Editors change the dashboard defaults; readers keep their choice in the URL. */
  const changeFilters = useCallback((next: DashboardFilters) => {
    setCross(null);
    if (canEdit) {
      setDefaultFilters(next);
      setParams({}, { replace: true });
    } else {
      setParams(filtersToParams(next, board.filters), { replace: true });
    }
  }, [canEdit, board.filters, setParams]);

  const resetFilters = useCallback(() => {
    changeFilters({ period: DEFAULT_PERIOD, dims: filters.dims.map((f) => ({ dim: f.dim, values: [] })) });
  }, [changeFilters, filters.dims]);

  const pick = useCallback((group: string) => (name: string) => {
    const c = useStore.getState().cross;
    setCross(c && c.value === name ? null : { group, value: name });
  }, []);

  const mn = minSpan(gw);
  const showHint = !edit && cards.some((c) => CLICKABLE[c.type] && GROUPS[c.q.group]?.kind === 'cat');

  return (
    <div className={'board ' + (edit ? 'edit' : 'view')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {readOnly && role === 'editor' && (
        <div className="banner" role="status"><Icon name="alert" />Dashboard ini disimpan oleh versi Rangkai yang lebih baru, jadi dibuka hanya untuk dibaca. Muat ulang aplikasi untuk mengubahnya.</div>
      )}
      <FilterLine board={board} filters={filters} edit={edit} onChange={changeFilters} onReset={resetFilters} showHint={showHint} />
      {edit && (
        <div className="edit-bar">
          <Icon name="sparkle" />
          <span>Klik visual untuk mengubah, seret judulnya untuk memindah, tarik tepi kanan atau bawah untuk mengubah ukuran.</span>
          <div className="spacer" />
          <button type="button" className="btn" onClick={addPage}><Icon name="page" />Tambah halaman</button>
        </div>
      )}
      <PageTabs board={board} edit={edit} />
      {!cards.length ? (
        canEdit ? (
          <div className="empty-hero">
            <div className="eh-ic"><Icon name="sparkle" /></div>
            <h2>Mulai dengan satu pertanyaan</h2>
            <p>Pilih contoh di bawah untuk langsung menambahkannya, atau rakit sendiri. Semuanya bisa diubah nanti.</p>
            <div className="starters">
              {STARTERS.map((s, i) => <button type="button" key={s.label} className="starter" onClick={() => addStarter(i)}>{s.label}</button>)}
            </div>
            <button type="button" className="btn primary lg" onClick={() => openComposer(null)}><Icon name="plus" />Rakit visual sendiri</button>
          </div>
        ) : (
          <div className="empty-hero">
            <h2>Halaman ini belum berisi visual</h2>
            <p>Minta editor dashboard ini untuk menambahkan isinya.</p>
            <Link className="btn" to="/"><Icon name="home" />Kembali ke beranda</Link>
          </div>
        )
      ) : (
        <div className="grid" id="grid" ref={gridRef}>
          {cards.map((c, i) => {
            const r = results.get(c.id)!;
            const clickable = !edit && CLICKABLE[c.type] && GROUPS[c.q.group]?.kind === 'cat';
            return (
              <VisualCard
                key={c.id}
                card={c}
                result={r}
                filters={filters}
                edit={edit}
                selected={selected === c.id}
                flash={flash === c.id}
                span={effSpan(c.span, gw, vw)}
                minSpan={mn}
                gridWidth={gw}
                highlight={cross && cross.group === c.q.group ? cross.value : null}
                onPick={clickable ? pick(c.q.group) : undefined}
                onResetFilters={resetFilters}
                prevId={cards[i - 1]?.id}
                nextId={cards[i + 1]?.id}
              />
            );
          })}
          {edit && (
            <button type="button" className="add-tile" style={{ gridColumn: 'span ' + effSpan(4, gw, vw) }} onClick={() => openComposer(null)}>
              <Icon name="plus" /><span>Tambah visual</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
