import { useNavigate } from 'react-router';
import { CONNECTORS, TEMPLATES } from '../core/board';
import { closeModal, createBoard, pickConnector, pickTemplate, setNewBoardName, useStore } from '../store/store';
import { useTone } from './CardBody';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

function TemplateButton({ k, on }: { k: string; on: boolean }) {
  const t = TEMPLATES[k];
  const tone = useTone(t.tone);
  const n = t.cards().length;
  return (
    <button type="button" className={'tpl' + (on ? ' on' : '')} aria-pressed={on} onClick={() => pickTemplate(k)}>
      <span className="badge-ic" style={{ background: tone[0], color: tone[1] }}><Icon name={t.icon} /></span>
      <div><b>{t.label}</b><span>{t.desc}{n ? '. Berisi ' + n + ' visual.' : '.'}</span></div>
    </button>
  );
}

function NewBoardModal({ tpl, name }: { tpl: string; name: string }) {
  const navigate = useNavigate();
  const create = () => {
    const id = createBoard();
    if (id) navigate('/d/' + id);
  };
  return (
    <Sheet narrow onClose={closeModal} labelledBy="nbT" initialFocus="#nbName">
      <div className="sheet-head">
        <div><div className="kicker">Dashboard baru</div><h2 id="nbT">Mulai dari mana?</h2></div>
        <button type="button" className="btn icon ghost" onClick={closeModal} aria-label="Tutup"><Icon name="close" /></button>
      </div>
      <div className="modal-body">
        <label className="field">Nama dashboard
          <input className="input" id="nbName" value={name} maxLength={60} onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} />
        </label>
        <div className="tpl-grid">
          {Object.keys(TEMPLATES).map((k) => <TemplateButton key={k} k={k} on={tpl === k} />)}
        </div>
      </div>
      <div className="sheet-foot">
        <div className="spacer" />
        <button type="button" className="btn" onClick={closeModal}>Batal</button>
        <button type="button" className="btn primary" onClick={create}><Icon name="check" />Buat dashboard</button>
      </div>
    </Sheet>
  );
}

function ConnectModal() {
  return (
    <Sheet narrow onClose={closeModal} labelledBy="cnT">
      <div className="sheet-head">
        <div><div className="kicker">Sumber data</div><h2 id="cnT">Sambungkan dari mana?</h2></div>
        <button type="button" className="btn icon ghost" onClick={closeModal} aria-label="Tutup"><Icon name="close" /></button>
      </div>
      <div className="modal-body">
        <p className="muted" style={{ margin: 0 }}>Ini simulasi. Di versi produksi, langkah berikutnya meminta alamat dan kredensial, lalu mengecek koneksinya. Kredensial tidak pernah dikirim ke browser.</p>
        {CONNECTORS.map(([name, desc], i) => (
          <button type="button" key={name} className="srow" style={{ textAlign: 'left' }} onClick={() => pickConnector(i)}>
            <span className="badge-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="db" /></span>
            <div><b>{name}</b><span>{desc}</span></div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function Modals() {
  const modal = useStore((s) => s.modal);
  if (!modal) return null;
  if (modal.type === 'new') return <NewBoardModal tpl={modal.tpl} name={modal.name} />;
  return <ConnectModal />;
}
