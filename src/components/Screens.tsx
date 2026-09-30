import { useMemo } from 'react';
import { Link } from 'react-router';
import { TAG_COLORS } from '../core/board';
import { genData } from '../core/engine';
import { ago } from '../core/format';
import { MEASURES } from '../core/semantic';
import type { Board } from '../core/types';
import { openConnect, openNewBoard, setSearch, useStore } from '../store/store';
import { useTone } from './CardBody';
import { Chart } from './Chart';
import { Icon } from './Icon';

function BoardThumb({ board }: { board: Board }) {
  const asOf = useStore((s) => s.asOf);
  const first = board.cards.find((c) => c.q.group !== 'none' && MEASURES[c.q.measure]) ?? board.cards.find((c) => MEASURES[c.q.measure]);
  const data = useMemo(() => (first ? genData(first.q, board.filters, { asOf: new Date(asOf) }) : null), [first, board.filters, asOf]);
  if (!first || !data) return <div className="thumb-empty">Belum ada visual</div>;
  return <Chart kind="spark" data={data} q={first.q} color={TAG_COLORS[board.tag] || TAG_COLORS.Umum} mini />;
}

export function HomeScreen() {
  const boards = useStore((s) => s.boards);
  const role = useStore((s) => s.role);
  const search = useStore((s) => s.search);
  const qq = search.trim().toLowerCase();
  const list = boards.filter((b) => !qq || b.name.toLowerCase().includes(qq)).sort((a, b) => b.updatedAt - a.updatedAt);
  const editor = role === 'editor';

  return (
    <>
      <section className="hero">
        <div>
          <h1>Mau lihat apa hari ini?</h1>
          <p className="muted">Buka dashboard yang sudah ada, atau buat yang baru cukup dengan menyusun satu kalimat.</p>
        </div>
        {editor && <button type="button" className="btn primary lg" onClick={openNewBoard}><Icon name="plus" />Dashboard baru</button>}
      </section>
      <label className="search">
        <Icon name="search" />
        <input type="search" placeholder="Cari dashboard" value={search} aria-label="Cari dashboard" onChange={(e) => setSearch(e.target.value)} />
      </label>
      <div className="boards">
        {list.map((b) => {
          const col = TAG_COLORS[b.tag] || TAG_COLORS.Umum;
          return (
            <Link key={b.id} className="bcard" to={'/d/' + b.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="bthumb"><BoardThumb board={b} /></div>
              <div className="bbody">
                <div className="bname">{b.name}</div>
                <div className="bmeta">
                  <span className="tag" style={{ ['--t' as string]: col }}>{b.tag}</span>
                  {b.cards.length} visual, diubah {ago(b.updatedAt)}
                </div>
              </div>
            </Link>
          );
        })}
        {!list.length && (
          <div className="empty-hero" style={{ gridColumn: '1/-1', padding: 32 }}>
            <h2 style={{ fontSize: 18 }}>Tidak ada dashboard bernama “{search}”</h2>
            <p>Periksa ejaannya, atau buat dashboard baru dengan nama itu.</p>
            <button type="button" className="link" onClick={() => setSearch('')}>Hapus pencarian</button>
          </div>
        )}
        {editor && !qq && (
          <button type="button" className="bcard new" onClick={openNewBoard}>
            <Icon name="plus" /><b>Buat dashboard</b><span>Pakai template atau mulai kosong</span>
          </button>
        )}
      </div>
    </>
  );
}

function MeasureChip({ id }: { id: string }) {
  const m = MEASURES[id];
  const tone = useTone(m.tone);
  return (
    <span className="mchip">
      <span className="badge-ic" style={{ background: tone[0], color: tone[1] }}><Icon name={m.icon} /></span>
      {m.label}<small>dari {m.src}</small>
    </span>
  );
}

const STATUS_TEXT = { ok: 'sehat', warn: 'terlambat', err: 'gagal' } as const;

export function DataScreen() {
  const sources = useStore((s) => s.sources);
  const editor = useStore((s) => s.role === 'editor');
  return (
    <>
      <section className="hero">
        <div>
          <h1>Sumber data</h1>
          <p className="muted">Sambungkan sekali, lalu isinya langsung muncul sebagai pilihan di kalimat “Tampilkan …”. Tidak perlu menulis query.</p>
        </div>
      </section>
      <div className="data-grid">
        <div className="panel">
          <div className="panel-h"><b>Data yang dipakai grafik</b></div>
          <p className="demo-note"><Icon name="info" /><span>Demo ini memakai <b>data contoh</b>: angka simulasi dengan struktur asli, lewat jalur query yang sama dengan data live. Aman untuk mencoba menyusun dashboard. Data live butuh Composer API dan belum tersedia di demo publik.</span></p>
        </div>
        <div className="panel">
          <div className="panel-h">
            <b>Tersambung</b>
            {editor && <button type="button" className="btn" onClick={openConnect}><Icon name="plus" />Sambungkan</button>}
          </div>
          {sources.map((s, i) => {
            const col = s.status === 'ok' ? 'var(--success)' : s.status === 'warn' ? 'var(--warn)' : 'var(--danger)';
            return (
              <div className="srow" key={s.name + i}>
                <span className="dotc" style={{ background: col, width: 10, height: 10 }} aria-hidden="true" />
                <div><b>{s.name}</b><span>{s.detail}</span></div>
                <div className="st" style={{ color: s.status === 'err' ? 'var(--danger)' : 'var(--muted)' }}>
                  <span className="sr-only">Status {STATUS_TEXT[s.status]}. </span>{s.sync}
                </div>
              </div>
            );
          })}
        </div>
        <div className="panel wide">
          <div className="panel-h"><b>Yang bisa kamu tanyakan</b></div>
          <div className="chips">{Object.keys(MEASURES).map((k) => <MeasureChip key={k} id={k} />)}</div>
        </div>
      </div>
    </>
  );
}
