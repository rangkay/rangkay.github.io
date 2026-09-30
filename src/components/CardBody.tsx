import { ruleColor, type CardResult } from '../core/engine';
import { fm, fmtDelta, fmtNum } from '../core/format';
import { autoTitle } from '../core/query';
import { GROUPS, MEASURES } from '../core/semantic';
import type { Card, Tone } from '../core/types';
import { useStore } from '../store/store';
import { Chart } from './Chart';

export const TONES: Record<Tone, [string, string]> = {
  blue: ['#DBEAFE', '#1D4ED8'], red: ['#FEE2E2', '#DC2626'], green: ['#D1FAE5', '#047857'], violet: ['#EDE9FE', '#6D28D9'], amber: ['#FEF3C7', '#B45309'],
};
const TONES_DARK: Record<Tone, [string, string]> = {
  blue: ['rgba(59,130,246,.2)', '#93C5FD'], red: ['rgba(239,68,68,.2)', '#FCA5A5'], green: ['rgba(16,185,129,.2)', '#6EE7B7'],
  violet: ['rgba(139,92,246,.22)', '#C4B5FD'], amber: ['rgba(245,158,11,.2)', '#FCD34D'],
};

export function useTone(t: Tone | undefined): [string, string] {
  const dark = useStore((s) => s.dark);
  return (dark ? TONES_DARK : TONES)[t ?? 'blue'];
}

export function EmptyBody({ onReset }: { onReset?: () => void }) {
  return (
    <div className="empty-chart" role="status">
      <b>Tidak ada data</b>
      <span>Kombinasi filter ini tidak menyisakan baris.</span>
      {onReset && <button type="button" className="link" onClick={onReset}>Atur ulang filter dashboard</button>}
    </div>
  );
}

export function ErrorBody({ message, onFix }: { message: string; onFix?: () => void }) {
  return (
    <div className="empty-chart err" role="alert">
      <b>Visual ini tidak bisa ditampilkan</b>
      <span>{message}</span>
      {onFix && <button type="button" className="link" onClick={onFix}>Ganti ukuran</button>}
    </div>
  );
}

function KpiBody({ card, r }: { card: Card; r: CardResult }) {
  const f = fm(card.q);
  const m = MEASURES[card.q.measure];
  const tone = useTone(m?.tone);
  const rc = ruleColor(r.single, card.q.rule);
  const good = m?.good === 'up' ? r.delta >= 0 : r.delta <= 0;
  return (
    <div className="kpi">
      <div className="kpi-val" style={rc ? { color: rc } : undefined}>
        {fmtNum(r.single, f, true)}
        {!f.pct && f.unit && <span className="unit">{f.unit}</span>}
      </div>
      <div className={'delta ' + (good ? 'up' : 'down')}>
        {r.delta >= 0 ? '▲' : '▼'} {fmtDelta(r.delta, f)}<span>dibanding periode sebelumnya</span>
      </div>
      <div className="kpi-spark">
        <Chart kind="spark" data={r} q={card.q} color={rc || tone[1]} mini />
      </div>
    </div>
  );
}

function TableBody({ card, r }: { card: Card; r: CardResult }) {
  const f = fm(card.q);
  if (!r.categories) {
    return (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Ukuran</th><th className="num">Nilai</th></tr></thead>
          <tbody><tr><td>{autoTitle(card.q)}</td><td className="num">{fmtNum(r.single, f)}</td></tr></tbody>
        </table>
      </div>
    );
  }
  const g = GROUPS[card.q.group];
  const noun = g.noun || (g.kind === 'time' ? 'Waktu' : 'Kategori');
  const showTotal = !f.pct && (card.q.agg === 'sum' || card.q.agg === 'count');
  return (
    <div className="tbl-wrap" tabIndex={0} aria-label={'Tabel ' + autoTitle(card.q)}>
      <table className="tbl">
        <thead>
          <tr><th scope="col">{noun}</th>{r.series.map((s) => <th scope="col" className="num" key={s.name}>{s.name}</th>)}</tr>
        </thead>
        <tbody>
          {r.categories.map((c, i) => (
            <tr key={c}><td>{c}</td>{r.series.map((s) => <td className="num" key={s.name}>{fmtNum(s.values[i], f, true)}</td>)}</tr>
          ))}
          {showTotal && (
            <tr className="total"><td>Total</td>{r.series.map((s) => <td className="num" key={s.name}>{fmtNum(s.values.reduce((a, b) => a + b, 0), f, true)}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Mini previews in the composer's recommendation cards for DOM-only types. */
export function MiniDom({ type, card, r }: { type: 'kpi' | 'table'; card: Pick<Card, 'q'>; r: CardResult }) {
  const f = fm(card.q);
  if (type === 'kpi') {
    return (
      <div className="mini-kpi">
        <b>{fmtNum(r.single, f, true)}</b>
        <span className={'delta ' + (r.delta >= 0 ? 'up' : 'down')}>{r.delta >= 0 ? '▲' : '▼'} {fmtDelta(r.delta, f)}</span>
      </div>
    );
  }
  const rows: [string, number | null][] = r.categories
    ? r.categories.slice(0, 3).map((c, i) => [c, r.series[0].values[i]])
    : [[MEASURES[card.q.measure]?.label ?? '', r.single]];
  return (
    <table className="mini-tbl"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{fmtNum(v, f, true)}</td></tr>)}</tbody></table>
  );
}

export function CardBody({ card, r, highlight, onPick, onReset, onFix }: {
  card: Card;
  r: CardResult;
  highlight?: string | null;
  onPick?: (name: string) => void;
  onReset?: () => void;
  onFix?: () => void;
}) {
  if (r.status === 'error') return <ErrorBody message={r.error?.message ?? ''} onFix={onFix} />;
  if (r.status === 'empty') return <EmptyBody onReset={onReset} />;
  if (card.type === 'kpi') return <KpiBody card={card} r={r} />;
  if (card.type === 'table') return <TableBody card={card} r={r} />;
  return <Chart kind={card.type} data={r} q={card.q} highlight={highlight} onPick={onPick} label={autoTitle(card.q)} />;
}
