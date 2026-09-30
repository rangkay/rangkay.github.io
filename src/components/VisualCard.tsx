import { useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { CardResult } from '../core/engine';
import { clamp } from '../core/format';
import { subText } from '../core/filters';
import { COLS, MAX_H, MIN_H, sizeLabel } from '../core/layout';
import { cardTitle } from '../core/query';
import { MEASURES } from '../core/semantic';
import type { Card, DashboardFilters } from '../core/types';
import { deleteCard, duplicateCard, moveCard, openComposer, resizeCard, select } from '../store/store';
import { CardBody, useTone } from './CardBody';
import { dragging } from './dnd';
import { Icon } from './Icon';

interface Props {
  card: Card;
  result: CardResult;
  filters: DashboardFilters;
  edit: boolean;
  selected: boolean;
  flash: boolean;
  /** span actually used (after the minimum-width rule) */
  span: number;
  minSpan: number;
  gridWidth: number;
  highlight: string | null;
  onPick?: (name: string) => void;
  onResetFilters: () => void;
  /** neighbours on the page, for keyboard reordering */
  prevId?: string;
  nextId?: string;
}

type Axis = 'w' | 'h' | 'xy';

export function VisualCard(p: Props) {
  const { card, edit } = p;
  const [live, setLive] = useState<{ span: number; h: number } | null>(null);
  const [drop, setDrop] = useState<'L' | 'R' | null>(null);
  const [isDragging, setDragging] = useState(false);
  const m = MEASURES[card.q.measure];
  const tone = useTone(m?.tone);
  const title = cardTitle(card);
  const sub = subText(card.q, p.filters);
  const span = live?.span ?? p.span;
  const h = live?.h ?? card.h;

  function startResize(e: ReactPointerEvent, axis: Axis) {
    e.preventDefault();
    e.stopPropagation();
    const colW = ((p.gridWidth || 1000) + 14) / COLS;
    const st = { x: e.clientX, y: e.clientY, span: p.span, h: card.h };
    let cur = { span: st.span, h: st.h };
    setLive(cur);
    select(card.id);
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - st.x;
      const dy = ev.clientY - st.y;
      cur = {
        span: axis !== 'h' ? clamp(st.span + Math.round(dx / colW), p.minSpan, COLS) : st.span,
        h: axis !== 'w' ? clamp(Math.round(st.h + dy), MIN_H, MAX_H) : st.h,
      };
      setLive(cur);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setLive(null);
      if (cur.span !== card.span || cur.h !== card.h) resizeCard(card.id, cur.span, cur.h);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!edit || e.target !== e.currentTarget) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      openComposer(card.id);
      return;
    }
    if (!e.altKey) return;
    // Alt+←/→ moves the visual; Alt+Shift+arrows resizes it.
    if (e.shiftKey) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key];
      if (!d) return;
      e.preventDefault();
      resizeCard(card.id, clamp(p.span + d[0], p.minSpan, COLS), clamp(card.h + d[1], MIN_H, MAX_H));
    } else if (e.key === 'ArrowLeft' && p.prevId) {
      e.preventDefault();
      moveCard(card.id, p.prevId, true);
    } else if (e.key === 'ArrowRight' && p.nextId) {
      e.preventDefault();
      moveCard(card.id, p.nextId, false);
    }
    requestAnimationFrame(() => (document.querySelector(`[data-card="${card.id}"]`) as HTMLElement | null)?.focus());
  }

  const cls = ['card-w'];
  if (p.selected && edit) cls.push('sel');
  if (p.flash) cls.push('flash');
  if (isDragging) cls.push('dragging');
  if (drop) cls.push(drop === 'L' ? 'dropL' : 'dropR');
  if (live) cls.push('resizing');
  if (p.result.status === 'error') cls.push('errored');

  return (
    <article
      className={cls.join(' ')}
      style={{ gridColumn: 'span ' + span, height: h }}
      data-card={card.id}
      tabIndex={edit ? 0 : undefined}
      aria-label={title}
      aria-keyshortcuts={edit ? 'Enter Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight' : undefined}
      onClick={edit ? () => select(card.id) : undefined}
      onDoubleClick={edit ? (e) => { if (!(e.target as HTMLElement).closest('.card-tools')) openComposer(card.id); } : undefined}
      onKeyDown={onKeyDown}
      onDragOver={edit ? (e) => {
        if (!dragging.id || dragging.id === card.id) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setDrop(e.clientX < r.left + r.width / 2 ? 'L' : 'R');
      } : undefined}
      onDragLeave={edit ? () => setDrop(null) : undefined}
      onDrop={edit ? (e) => {
        e.preventDefault();
        const from = dragging.id;
        const before = drop === 'L';
        setDrop(null);
        dragging.id = null;
        if (from && from !== card.id) moveCard(from, card.id, before);
      } : undefined}
    >
      <div
        className="card-head"
        draggable={edit}
        onDragStart={edit ? (e) => {
          dragging.id = card.id;
          try {
            e.dataTransfer.setData('text/plain', card.id);
            e.dataTransfer.effectAllowed = 'move';
          } catch { /* some browsers refuse custom data; the module state is enough */ }
          requestAnimationFrame(() => setDragging(true));
        } : undefined}
        onDragEnd={edit ? () => { dragging.id = null; setDragging(false); } : undefined}
      >
        {card.type === 'kpi' && m && (
          <span className="badge-ic" style={{ background: tone[0], color: tone[1] }}><Icon name={m.icon} /></span>
        )}
        <div className="ct">
          <div className="card-title" title={title}>{title}</div>
          <div className="card-sub" title={sub}>{sub}</div>
        </div>
      </div>
      <div className="card-body">
        <CardBody card={card} r={p.result} highlight={p.highlight} onPick={p.onPick} onReset={p.onResetFilters}
          onFix={edit ? () => openComposer(card.id) : undefined} />
      </div>
      {edit && (
        <>
          <div className="card-tools">
            <button type="button" className="tool" onClick={(e) => { e.stopPropagation(); openComposer(card.id); }}><Icon name="pen" />Ubah</button>
            <button type="button" className="tool" title="Duplikat" aria-label={'Duplikat ' + title} onClick={(e) => { e.stopPropagation(); duplicateCard(card.id); }}><Icon name="dup" /></button>
            <button type="button" className="tool danger" title="Hapus" aria-label={'Hapus ' + title} onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}><Icon name="trash" /></button>
          </div>
          <div className="handle hw" title="Tarik untuk mengubah lebar" onPointerDown={(e) => startResize(e, 'w')} />
          <div className="handle hh" title="Tarik untuk mengubah tinggi" onPointerDown={(e) => startResize(e, 'h')} />
          <div className="handle hxy" title="Tarik untuk mengubah ukuran" onPointerDown={(e) => startResize(e, 'xy')} />
          {live && <div className="sizebadge" role="status">{sizeLabel(live, p.minSpan)}</div>}
        </>
      )}
    </article>
  );
}
