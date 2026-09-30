import { useMemo } from 'react';
import { STARTERS } from '../core/board';
import { runQuery } from '../core/engine';
import { effState, subText } from '../core/filters';
import { fm } from '../core/format';
import { autoTitle, normQ, sameQ, sentenceOptions } from '../core/query';
import { DIMS, MEASURES, SOURCES } from '../core/semantic';
import { REASON, RULEABLE, SINGLE, TYPE_LABEL, TYPES, recommend, unsuitable } from '../core/visuals';
import type { Card, RuleOp, RuleTone } from '../core/types';
import { useActiveFilters } from '../store/selectors';
import {
  applyStarter, closeComposer, commitComposer, resetAutoTitle, setCardFilter, setComposerTitle, setComposerType, setFollow, setQ, setRule,
  setRuleOn, toggleAllTypes, useStore, type ComposerState,
} from '../store/store';
import { CardBody, MiniDom, useTone } from './CardBody';
import { Chart } from './Chart';
import { MultiPill, Pill, Switch } from './controls';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

function MeasureSelect({ value }: { value: string }) {
  const bySource: Record<string, string[]> = {};
  Object.values(MEASURES).forEach((m) => (bySource[m.src] ||= []).push(m.id));
  return (
    <select className="pill" value={value} aria-label="Ukuran" onChange={(e) => setQ('measure', e.target.value)}>
      {!MEASURES[value] && <option value={value}>ukuran tidak tersedia</option>}
      {Object.keys(bySource).map((src) => (
        <optgroup label={src} key={src}>
          {bySource[src].map((k) => <option key={k} value={k}>{MEASURES[k].lower}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function ComposerBody({ C }: { C: ComposerState }) {
  const { filters } = useActiveFilters();
  const asOf = useStore((s) => s.asOf);
  const hasDashFilters = useStore((s) => (s.boards.find((b) => b.id === s.boardId)?.filters.dims.length ?? 0) > 0);
  const q = C.q;
  const m = MEASURES[q.measure];
  const tone = useTone(m?.tone);
  const isNew = !C.cardId;
  const opts = sentenceOptions(q);
  const recs = recommend(q);
  const warn = unsuitable(C.type, q);
  const cst = effState(q, filters);
  const title = C.autoTitle ? autoTitle(q) : C.title;

  const result = useMemo(
    () => runQuery({ dashboardFilters: filters, cards: [{ id: 'preview', query: q }] }, { asOf: new Date(asOf) })[0],
    [filters, q, asOf],
  );
  const preview: Card = { id: 'preview', page: '', q, type: C.type, auto: C.autoTitle, title: C.title, span: 12, h: 300 };
  const groups = [...new Set(TYPES.map((t) => t[2]))];

  return (
    <>
      <div className="sheet-head">
        <div>
          <div className="kicker">{isNew ? 'Visual baru' : 'Ubah visual'}</div>
          <h2 id="cmpTitle">Apa yang ingin kamu lihat?</h2>
        </div>
        <button type="button" className="btn icon ghost" onClick={closeComposer} title="Tutup (Esc)" aria-label="Tutup"><Icon name="close" /></button>
      </div>
      <div className="sheet-body">
        <div className="sheet-left">
          {isNew && (
            <div className="starters left">
              <span className="muted sm" style={{ marginRight: 4 }}>Contoh cepat:</span>
              {STARTERS.map((s, i) => {
                const on = sameQ(normQ({ split: 'none', period: 'dash', ...s.q }), q);
                return <button type="button" key={s.label} className={'starter' + (on ? ' on' : '')} aria-pressed={on} onClick={() => applyStarter(i)}>{s.label}</button>;
              })}
            </div>
          )}
          <div className="step"><span className="num">1</span><b>Susun pertanyaannya</b></div>
          <div className="sentence" data-testid="sentence">
            Tampilkan{' '}
            {m && <Pill label="Cara menghitung" value={q.agg} options={opts.aggs} onChange={(v) => setQ('agg', v)} />}{' '}
            <MeasureSelect value={q.measure} />{' '}
            {m && <Pill label="Kelompokkan" value={q.group} options={opts.groups} onChange={(v) => setQ('group', v)} />}
            {opts.splits.length > 1 && <> <Pill label="Rincian" value={q.split} options={opts.splits} onChange={(v) => setQ('split', v)} /></>}
            {' '}untuk <Pill label="Periode" value={q.period} options={opts.periods} onChange={(v) => setQ('period', v)} />
          </div>
          {m && (
            <div className="sentence small">
              Batasi ke{' '}
              {SOURCES[m.src].dims.map((d) => (
                <span key={d}>
                  <MultiPill dim={d} values={q.filters.find((f) => f.dim === d)?.values ?? []} onChange={(v) => setCardFilter(d, v)} />{' '}
                </span>
              ))}
            </div>
          )}
          {cst.empty ? (
            <div className="warn" role="status"><Icon name="alert" /><span>Filter visual ini dan filter dashboard tidak menyisakan data.</span></div>
          ) : cst.ignored.length > 0 && m ? (
            <p className="hint"><Icon name="info" /><span>Filter {cst.ignored.map((d) => DIMS[d].lower).join(' dan ')} di dashboard tidak berlaku untuk {m.src}.</span></p>
          ) : null}
          {hasDashFilters && (
            <div className="rule">
              <Switch checked={q.follow} onChange={setFollow} label="Ikuti filter dashboard" />
              <div>
                <b>Ikuti filter dashboard</b>
                <div className="muted">Kalau dimatikan, visual ini mengabaikan filter lini, shift, dan lainnya di bagian atas dashboard. Periode diatur di kalimat di atas.</div>
              </div>
            </div>
          )}
          <p className="hint"><Icon name="info" /><span>Pilihan yang tidak cocok dengan data ini otomatis disembunyikan, jadi kombinasi apa pun tetap masuk akal.</span></p>

          <div className="step"><span className="num">2</span><b>Pilih tampilan</b><span className="muted">yang paling pas untuk pertanyaan ini</span></div>
          <div className="recs">
            {recs.map((t, i) => (
              <button type="button" key={t} className={'rec' + (C.type === t ? ' on' : '')} aria-pressed={C.type === t} onClick={() => setComposerType(t)}>
                <div className="mini">
                  {result.status !== 'ok' ? null : t === 'kpi' || t === 'table'
                    ? <MiniDom type={t} card={{ q }} r={result} />
                    : <Chart kind={t} data={result} q={q} mini />}
                </div>
                <div className="rec-t"><b>{TYPE_LABEL[t]}</b>{i === 0 && <em>Paling pas</em>}</div>
                <span>{REASON[t]}</span>
              </button>
            ))}
          </div>
          {warn && (
            <div className="warn" role="status">
              <Icon name="alert" />
              <span><b>{TYPE_LABEL[C.type]}</b> kurang pas di sini: {warn}.</span>
              <button type="button" className="link" onClick={() => setComposerType(recs[0])}>Pakai {TYPE_LABEL[recs[0]]}</button>
            </div>
          )}
          <button type="button" className="link" aria-expanded={C.showAll} onClick={toggleAllTypes}>
            {C.showAll ? 'Sembunyikan tipe lain' : 'Lihat semua ' + TYPES.length + ' tipe tampilan'}<Icon name={C.showAll ? 'up' : 'down'} />
          </button>
          {C.showAll && (
            <div>
              {groups.map((g) => (
                <div key={g}>
                  <div className="type-cat">{g}</div>
                  <div className="types">
                    {TYPES.filter((t) => t[2] === g).map(([id, label]) => {
                      const u = unsuitable(id, q);
                      return (
                        <button type="button" key={id} className={'type' + (C.type === id ? ' on' : '') + (u ? ' dim' : '')} aria-pressed={C.type === id} onClick={() => setComposerType(id)}>
                          {label}{u && <small>Kurang pas</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {RULEABLE[C.type] && m && (
            <>
              <div className="rule">
                <Switch checked={!!q.rule} onChange={(on) => setRuleOn(on, filters)} label="Beri warna peringatan" />
                <div><b>Beri warna peringatan</b><div className="muted">Angkanya berubah warna kalau melewati batas yang kamu tentukan.</div></div>
              </div>
              {q.rule && (
                <div className="sentence small">
                  Kalau nilainya <Pill label="Kondisi" value={q.rule.op} options={[['lt', 'di bawah'], ['gt', 'di atas']]} onChange={(v) => setRule({ op: v as RuleOp })} />{' '}
                  <input className="num-in" type="number" step="any" defaultValue={q.rule.value} aria-label="Batas" key={q.measure + q.agg}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value.replace(',', '.'));
                      if (Number.isFinite(n)) setRule({ value: n });
                    }} />{' '}
                  {fm(q).pct ? '% ' : ''}tandai <Pill label="Warna" value={q.rule.tone} options={[['danger', 'merah'], ['warn', 'kuning'], ['success', 'hijau']]} onChange={(v) => setRule({ tone: v as RuleTone })} />
                </div>
              )}
            </>
          )}
          <div className="step"><span className="num">3</span><b>Judul</b><span className="muted">dibuat otomatis, boleh diganti</span></div>
          <input className="input" id="cTitle" value={title} maxLength={80} aria-label="Judul visual" onChange={(e) => setComposerTitle(e.target.value)} />
          {!C.autoTitle && <button type="button" className="link" onClick={resetAutoTitle}>Pakai judul otomatis lagi</button>}
        </div>

        <div className="sheet-right">
          <div className="muted sm" style={{ fontWeight: 700 }}>Pratinjau langsung</div>
          <div className="preview-wrap">
            <div className={'card-w preview' + (SINGLE[C.type] ? ' is-single' : '')} aria-live="polite">
              <div className="card-head">
                {C.type === 'kpi' && m && <span className="badge-ic" style={{ background: tone[0], color: tone[1] }}><Icon name={m.icon} /></span>}
                <div className="ct">
                  <div className="card-title">{title || autoTitle(q)}</div>
                  <div className="card-sub">{subText(q, filters)}</div>
                </div>
              </div>
              <div className="card-body"><CardBody card={preview} r={result} /></div>
            </div>
            <div className="src"><Icon name="db" /><span>Diambil dari <b>{m?.src ?? 'sumber yang tidak tersedia'}</b>, memakai data contoh.</span></div>
          </div>
        </div>
      </div>
      <div className="sheet-foot">
        <span className="kbd hide-sm">Tekan Esc untuk batal</span>
        <div className="spacer" />
        <button type="button" className="btn" onClick={closeComposer}>Batal</button>
        <button type="button" className="btn primary" onClick={commitComposer} disabled={!m}>
          <Icon name="check" />{isNew ? 'Tambahkan ke dashboard' : 'Simpan perubahan'}
        </button>
      </div>
    </>
  );
}

export function Composer() {
  const C = useStore((s) => s.composer);
  if (!C) return null;
  return (
    <Sheet onClose={closeComposer} labelledBy="cmpTitle" initialFocus=".sentence .pill">
      <ComposerBody C={C} />
    </Sheet>
  );
}
