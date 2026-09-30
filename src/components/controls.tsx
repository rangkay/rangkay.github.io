import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { valsLabel } from '../core/filters';
import { DIMS } from '../core/semantic';
import { Icon } from './Icon';

/** A word in a sentence that can be changed: a native select styled as a pill. */
export function Pill({ value, options, onChange, label, small, testId }: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  label: string;
  small?: boolean;
  testId?: string;
}) {
  return (
    <select className={'pill' + (small ? ' sm' : '')} value={value} aria-label={label} data-testid={testId} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);
  return ref;
}

/**
 * Multi-select pill used for both dashboard and visual filters.
 * An empty list means "all"; at least one value must stay selected.
 */
export function MultiPill({ dim, values, onChange, extra }: {
  dim: string;
  values: string[];
  onChange: (v: string[]) => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const id = useId();
  const d = DIMS[dim];

  const toggle = (v: string, on: boolean) => {
    const base = values.length ? values : d.values;
    const next = d.values.filter((x) => (x === v ? on : base.includes(x)));
    if (!next.length) return;
    onChange(next.length === d.values.length ? [] : next);
  };

  return (
    <span className="fwrap" ref={ref}>
      <button type="button" className="pill pillbtn sm" aria-haspopup="true" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={'Filter ' + d.lower + ': ' + valsLabel(dim, values)} onClick={() => setOpen(!open)}>
        {valsLabel(dim, values)}
      </button>
      {extra}
      {open && (
        <div className="pop" id={id} role="group" aria-label={'Pilih ' + d.lower}>
          <div className="pop-h">
            <b>{d.label}</b>
            <button type="button" className="link" onClick={() => onChange([])}>Pilih semua</button>
          </div>
          {d.values.map((v) => {
            const on = values.length ? values.includes(v) : true;
            return (
              <label className="pop-i" key={v}>
                <input type="checkbox" checked={on} onChange={(e) => toggle(v, e.target.checked)} />
                <span>{v}</span>
              </label>
            );
          })}
          <div className="pop-f muted sm">
            {values.length ? values.length + ' dari ' + d.values.length + ' dipilih' : 'Semua ditampilkan, minimal satu harus dipilih'}
          </div>
        </div>
      )}
    </span>
  );
}

/** A small menu anchored to a button, e.g. "Tambah filter". */
export function MenuButton({ label, icon, children }: { label: string; icon?: 'plus'; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <span className="fwrap" ref={ref}>
      <button type="button" className="btn sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon && <Icon name={icon} />}{label}
      </button>
      {open && <div className="pop" role="menu" aria-label={label}>{children(close)}</div>}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}
