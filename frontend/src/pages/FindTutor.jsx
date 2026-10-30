import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, friendly } from '../api.js';
import { defaultPreferred, localInputToIso } from '../format.js';
import { ErrorNote, Field } from '../components/ui.jsx';

const SUGGEST = ['maths', 'physics', 'chemistry', 'algorithms', 'databases', 'statistics', 'economics', 'networks'];
const URGENCY = [['Low', 'Whenever'], ['Normal', 'This week'], ['High', 'ASAP']];

export default function FindTutor() {
  const nav = useNavigate();
  const [f, setF] = useState({ subject: '', topic: '', when: defaultPreferred(), urgency: 'Normal' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const req = await api.post('/requests', { subject: f.subject.trim(), topic: f.topic.trim(), preferredTime: localInputToIso(f.when), urgency: f.urgency });
      nav(`/requests/${req.id}/matches`);
    } catch (err) { setError(friendly(err)); setBusy(false); }
  };

  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Find a tutor</h1><p className="muted">Tell us what you are stuck on. We rank tutors by subject, time and level.</p></div></header>
      <form className="card stack" onSubmit={submit}>
        <Field label="Subject">
          <input list="subjects" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={60} placeholder="e.g. maths" required autoFocus />
          <datalist id="subjects">{SUGGEST.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="What do you need help with?" hint={`${f.topic.length}/200`}>
          <input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} maxLength={200} placeholder="e.g. Integration by parts" required />
        </Field>
        <Field label="Preferred date and time (IST)"><input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} required /></Field>
        <div className="field"><span>How urgent is it?</span>
          <div className="seg" role="radiogroup" aria-label="Urgency">
            {URGENCY.map(([v, label]) => <button type="button" role="radio" aria-checked={f.urgency === v} className={f.urgency === v ? 'on' : ''} key={v} onClick={() => setF({ ...f, urgency: v })}>{label}<small>{v}</small></button>)}
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button className="btn primary lg" disabled={busy || !f.subject.trim() || !f.topic.trim() || !f.when}>{busy ? 'Finding…' : 'Show matching tutors'}</button>
      </form>
    </div>
  );
}
