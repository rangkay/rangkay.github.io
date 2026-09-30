import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createHashRouter, Link, Outlet, RouterProvider, useLocation, useMatch, useNavigate, useParams } from 'react-router';
import { TAG_COLORS } from './core/board';
import { BoardScreen } from './components/BoardScreen';
import { Composer } from './components/Composer';
import { Fab, ToastView, type FabAction } from './components/Feedback';
import { useViewportWidth } from './components/hooks';
import { Icon } from './components/Icon';
import { Modals } from './components/Modals';
import { DataScreen, HomeScreen } from './components/Screens';
import { useCanEdit, useCurrentBoard } from './store/selectors';
import {
  cancelRename, canEdit, deleteCard, openBoard, openComposer, openConnect, openNewBoard, redo, renameBoard, select, setMode, setRole,
  startRenameBoard, toast, toggleTheme, undo, useStore,
} from './store/store';

const MOBILE_BELOW = 900;

function share() {
  const url = window.location.href;
  const fail = () => toast('Tautan tidak bisa disalin otomatis, salin dari bilah alamat');
  try {
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Tautan disalin'), fail);
    else fail();
  } catch {
    fail();
  }
}

function Side() {
  const boards = useStore((s) => s.boards);
  const role = useStore((s) => s.role);
  const dark = useStore((s) => s.dark);
  const boardId = useStore((s) => s.boardId);
  const onHome = useMatch('/');
  const onData = useMatch('/data');
  const recent = [...boards].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  return (
    <aside className="side" aria-label="Navigasi utama">
      <div className="brand">
        <div className="logo"><Icon name="layers" /></div>
        <div><b>Rangkai</b><small>Rangkai data jadi cerita</small></div>
      </div>
      <nav className="nav">
        <Link className={'navlink' + (onHome ? ' on' : '')} to="/" aria-current={onHome ? 'page' : undefined}><Icon name="home" />Beranda</Link>
        <Link className={'navlink' + (onData ? ' on' : '')} to="/data" aria-current={onData ? 'page' : undefined}><Icon name="db" />Sumber data</Link>
      </nav>
      <div>
        <div className="side-label">Terakhir dibuka</div>
        {recent.map((b) => (
          <Link key={b.id} to={'/d/' + b.id} className={'recent' + (boardId === b.id ? ' on' : '')}>
            <span className="dotc" style={{ background: TAG_COLORS[b.tag] || TAG_COLORS.Umum }} />{b.name}
          </Link>
        ))}
      </div>
      <div className="side-foot">
        <div className="side-label">Masuk sebagai (demo)</div>
        <div className="seg full" role="group" aria-label="Peran">
          <button type="button" className={role === 'editor' ? 'on' : ''} aria-pressed={role === 'editor'} onClick={() => setRole('editor')}>Editor</button>
          <button type="button" className={role === 'viewer' ? 'on' : ''} aria-pressed={role === 'viewer'} onClick={() => setRole('viewer')}>Pembaca</button>
        </div>
        <button type="button" className="btn ghost full" onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} />{dark ? 'Mode terang' : 'Mode gelap'}</button>
      </div>
    </aside>
  );
}

function BottomNav() {
  const dark = useStore((s) => s.dark);
  const boardId = useStore((s) => s.boardId);
  const role = useStore((s) => s.role);
  const onHome = useMatch('/');
  const onData = useMatch('/data');
  const onBoard = useMatch('/d/:boardId');
  const lastBoard = useStore((s) => s.boards[0]?.id);
  const target = boardId ?? lastBoard;
  return (
    <nav className="bnav" aria-label="Navigasi utama">
      <Link to="/" className={onHome ? 'on' : ''}><Icon name="home" />Beranda</Link>
      {target ? <Link to={'/d/' + target} className={onBoard ? 'on' : ''}><Icon name="layers" />Dashboard</Link> : null}
      <Link to="/data" className={onData ? 'on' : ''}><Icon name="db" />Data</Link>
      <button type="button" onClick={() => setRole(role === 'editor' ? 'viewer' : 'editor')}><Icon name="eye" />{role === 'editor' ? 'Editor' : 'Pembaca'}</button>
      <button type="button" onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} />Tema</button>
    </nav>
  );
}

function SaveState() {
  const st = useStore((s) => s.saveState);
  if (st === 'saving') return <div className="save" aria-live="polite">Menyimpan…</div>;
  return <div className="save" aria-live="polite"><Icon name="check" />{st === 'session' ? 'Tersimpan untuk sesi ini' : 'Tersimpan otomatis'}</div>;
}

function TopBar() {
  const board = useCurrentBoard();
  const onBoard = useMatch('/d/:boardId');
  const onData = useMatch('/data');
  const mode = useStore((s) => s.mode);
  const renaming = useStore((s) => s.renamingBoard);
  const hasUndo = useStore((s) => s.undo.length > 0);
  const hasRedo = useStore((s) => s.redo.length > 0);
  const editable = useCanEdit();
  const navigate = useNavigate();

  if (!onBoard || !board) {
    return (
      <header className="top">
        <div className="tt"><div className="title-plain">{onData ? 'Sumber data' : onBoard ? 'Dashboard' : 'Beranda'}</div></div>
        <div className="top-r"><div className="avatar" title="Pengguna demo" aria-label="Pengguna demo">RD</div></div>
      </header>
    );
  }
  const edit = mode === 'edit' && editable;
  return (
    <header className="top">
      <button type="button" className="btn icon ghost" onClick={() => navigate('/')} title="Kembali ke beranda" aria-label="Kembali ke beranda"><Icon name="back" /></button>
      <div className="tt">
        {renaming ? (
          <input className="title-input" defaultValue={board.name} maxLength={60} aria-label="Nama dashboard" autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => renameBoard(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
            }} />
        ) : edit ? (
          <button type="button" className="title-btn editable" onClick={startRenameBoard} title="Klik untuk mengganti nama">
            {board.name}<span className="pen"><Icon name="pen" /></span>
          </button>
        ) : (
          <h1 className="title-btn" style={{ margin: 0 }}>{board.name}</h1>
        )}
        {editable && <SaveState />}
      </div>
      <div className="top-r">
        {edit && (
          <>
            <button type="button" className="btn icon ghost" onClick={undo} title="Urungkan (Ctrl+Z)" aria-label="Urungkan" disabled={!hasUndo}><Icon name="undo" /></button>
            <button type="button" className="btn icon ghost" onClick={redo} title="Ulangi (Ctrl+Shift+Z)" aria-label="Ulangi" disabled={!hasRedo}><Icon name="redo" /></button>
          </>
        )}
        {editable && (
          <div className="seg" role="group" aria-label="Mode">
            <button type="button" className={!edit ? 'on' : ''} aria-pressed={!edit} onClick={() => setMode('view')}><Icon name="eye" /><span className="hide-sm">Lihat</span></button>
            <button type="button" className={edit ? 'on' : ''} aria-pressed={edit} onClick={() => setMode('edit')}><Icon name="pen" /><span className="hide-sm">Ubah</span></button>
          </div>
        )}
        <button type="button" className="btn icon ghost hide-sm" onClick={share} title="Salin tautan" aria-label="Salin tautan"><Icon name="link" /></button>
        <button type="button" className="btn icon ghost hide-sm" onClick={() => window.print()} title="Cetak atau simpan PDF" aria-label="Cetak"><Icon name="print" /></button>
      </div>
    </header>
  );
}

function useFabActions(): FabAction[] {
  const role = useStore((s) => s.role);
  const mode = useStore((s) => s.mode);
  const board = useCurrentBoard();
  const editable = useCanEdit();
  const onHome = useMatch('/');
  const onData = useMatch('/data');
  const editor = role === 'editor';
  if (onHome) return editor ? [{ icon: 'plus', label: 'Dashboard baru', run: openNewBoard }] : [];
  if (onData) return editor ? [{ icon: 'plus', label: 'Sambungkan sumber', run: openConnect }] : [];
  if (!board) return [];
  if (mode === 'edit' && editable) return [{ icon: 'plus', label: 'Tambah visual', run: () => openComposer(null) }];
  const acts: FabAction[] = [];
  if (editable) acts.push({ icon: 'pen', label: 'Ubah dashboard', run: () => setMode('edit') });
  acts.push({ icon: 'link', label: 'Salin tautan', run: share });
  acts.push({ icon: 'print', label: 'Cetak atau PDF', run: () => window.print() });
  return acts;
}

/** Undo/redo/delete shortcuts while editing a board. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') {
        if (s.composer || s.modal || e.defaultPrevented) return;
        if (s.selected) select(null);
        return;
      }
      if (typing || s.composer || s.modal || !s.boardId || s.mode !== 'edit' || !canEdit(s)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selected) {
        e.preventDefault();
        deleteCard(s.selected);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

function Shell() {
  const vw = useViewportWidth();
  const dark = useStore((s) => s.dark);
  const fab = useFabActions();
  const { pathname } = useLocation();
  useShortcuts();

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const mobile = vw < MOBILE_BELOW;
  return (
    <div id="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Lompat ke isi</a>
      {!mobile && <Side />}
      <div className="main">
        <TopBar />
        <main className="screen" id="main" tabIndex={-1}><Outlet /></main>
      </div>
      {mobile && <BottomNav />}
      <Fab key={pathname} actions={fab} />
      <Composer />
      <Modals />
      <ToastView />
    </div>
  );
}

function BoardRoute() {
  const { boardId = '' } = useParams();
  const exists = useStore((s) => s.boards.some((b) => b.id === boardId));
  useEffect(() => {
    openBoard(exists ? boardId : null);
  }, [boardId, exists]);
  const board = useCurrentBoard();
  if (!exists) {
    return (
      <div className="empty-hero">
        <div className="eh-ic"><Icon name="alert" /></div>
        <h2>Dashboard tidak ditemukan</h2>
        <p>Mungkin sudah dihapus, atau tautannya berasal dari browser lain. Dashboard di demo ini tersimpan di browser masing-masing.</p>
        <Link className="btn primary" to="/"><Icon name="home" />Kembali ke beranda</Link>
      </div>
    );
  }
  if (!board || board.id !== boardId) return null;
  return <BoardScreen board={board} />;
}

function LeaveBoard({ children }: { children: ReactNode }) {
  useEffect(() => {
    openBoard(null);
  }, []);
  return <>{children}</>;
}

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <LeaveBoard><HomeScreen /></LeaveBoard> },
      { path: 'data', element: <LeaveBoard><DataScreen /></LeaveBoard> },
      { path: 'd/:boardId', element: <BoardRoute /> },
      { path: '*', element: <LeaveBoard><HomeScreen /></LeaveBoard> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
