import { useEffect, useState } from 'react';
import { dismissToast, undo, useStore } from '../store/store';
import { Icon, type IconName } from './Icon';

/** Confirmation with an optional undo: about 5 s when undoable, 2.5 s otherwise. */
export function ToastView() {
  const t = useStore((s) => s.toast);
  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => dismissToast(t.id), t.undo ? 5200 : 2400);
    return () => clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={t.id}>
      <span>{t.msg}</span>
      {t.undo && <button type="button" onClick={() => { dismissToast(t.id); undo(); }}>Urungkan</button>}
    </div>
  );
}

export interface FabAction {
  icon: IconName;
  label: string;
  run: () => void;
}

/** The floating action button always offers the next step for the current screen. */
export function Fab({ actions }: { actions: FabAction[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!actions.length) return null;
  if (actions.length === 1) {
    const a = actions[0];
    return (
      <div className="fab-wrap">
        <div className="fab-row">
          <span className="fab-tip" aria-hidden="true">{a.label}</span>
          <button type="button" className="fab" aria-label={a.label} onClick={a.run}><Icon name={a.icon} /></button>
        </div>
      </div>
    );
  }
  return (
    <>
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      <div className="fab-wrap">
        {open && (
          <div className="fab-menu" role="menu">
            {actions.map((a) => (
              <button type="button" role="menuitem" key={a.label} className="fab-item" onClick={() => { setOpen(false); a.run(); }}>
                <span className="l">{a.label}</span><span className="c"><Icon name={a.icon} /></span>
              </button>
            ))}
          </div>
        )}
        <div className="fab-row">
          <button type="button" className={'fab' + (open ? ' open' : '')} aria-expanded={open} aria-haspopup="menu" aria-label="Aksi cepat" onClick={() => setOpen(!open)}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
    </>
  );
}
