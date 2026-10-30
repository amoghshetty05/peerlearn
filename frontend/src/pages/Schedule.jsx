import { useState } from 'react';
import { api, friendly } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { cap, DAYS, time12 } from '../format.js';
import Icon from '../components/Icon.jsx';
import { ErrorNote, Field, Spinner, Stars } from '../components/ui.jsx';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export default function Schedule() {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad('/tutors/me');
  const [sub, setSub] = useState({ subject: '', proficiency: 'Intermediate' });
  const [slot, setSlot] = useState({ weekday: 1, startTime: '16:00', endTime: '17:00' });
  const [subErr, setSubErr] = useState('');
  const [slotErr, setSlotErr] = useState('');

  const run = async (fn, setErr, ok) => {
    setErr('');
    try { await fn(); if (ok) toast(ok); reload(); } catch (e) { setErr(friendly(e)); }
  };
  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  const minutes = toMin(slot.endTime) - toMin(slot.startTime);
  const lengthOk = minutes >= 30 && minutes <= 120;
  const byDay = DAYS.map((name, d) => ({ name, d, slots: data.availability.filter((s) => s.weekday === d) })).filter((x) => x.d && x.slots.length);

  return (
    <div className="page">
      <header className="page-head"><div><h1>Your schedule</h1><p className="muted">Learners are matched on the subjects and weekly hours you set here.</p></div>
        <div className="stat compact"><span>Your rating</span><b>{data.rating.count ? data.rating.average.toFixed(1) : '–'}</b>{data.rating.count > 0 && <Stars value={data.rating.average} size={14} />}</div></header>

      <div className="two-col">
        <section className="card stack">
          <div className="row between"><h2>Subjects</h2><span className="muted small">{data.subjects.length} of 10</span></div>
          {data.subjects.length === 0 && <p className="muted">Add the subjects you can teach. Learners can only find you for these.</p>}
          <ul className="rows">
            {data.subjects.map((s) => (
              <li key={s.id}><b>{cap(s.subject)}</b>
                <select aria-label={`Level for ${s.subject}`} value={s.proficiency} onChange={(e) => run(() => api.put(`/tutors/me/subjects/${s.id}`, { proficiency: e.target.value }), setSubErr, 'Level updated.')}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
                <button className="icon-btn" aria-label={`Remove ${s.subject}`} onClick={() => run(() => api.del(`/tutors/me/subjects/${s.id}`), setSubErr)}><Icon name="trash" size={18} /></button></li>
            ))}
          </ul>
          <form className="add-row" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/tutors/me/subjects', { subject: sub.subject.trim(), proficiency: sub.proficiency }).then(() => setSub({ ...sub, subject: '' })), setSubErr, 'Subject added.'); }}>
            <Field label="New subject"><input value={sub.subject} onChange={(e) => setSub({ ...sub, subject: e.target.value })} maxLength={60} placeholder="e.g. algorithms" /></Field>
            <Field label="Level"><select value={sub.proficiency} onChange={(e) => setSub({ ...sub, proficiency: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
            <button className="btn primary" disabled={!sub.subject.trim() || data.subjects.length >= 10}><Icon name="plus" size={18} />Add</button>
          </form>
          {subErr && <ErrorNote>{subErr}</ErrorNote>}
        </section>

        <section className="card stack">
          <h2>Weekly availability</h2>
          {byDay.length === 0 && <p className="muted">No slots yet. Add slots of 30 to 120 minutes (campus time).</p>}
          <div className="week">
            {byDay.map(({ name, slots }) => (
              <div key={name} className="day"><b>{name}</b>
                <div className="chips">{slots.map((s) => (
                  <span className="chip slot static" key={s.id}>{time12(s.startTime)} – {time12(s.endTime)}
                    <button aria-label={`Remove ${name} ${s.startTime}`} onClick={() => run(() => api.del(`/tutors/me/availability/${s.id}`), setSlotErr)}><Icon name="x" size={14} /></button></span>))}</div>
              </div>))}
          </div>
          <form className="add-row three" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/tutors/me/availability', slot), setSlotErr, 'Slot added.'); }}>
            <Field label="Day"><select value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: Number(e.target.value) })}>{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></Field>
            <Field label="From"><input type="time" value={slot.startTime} onChange={(e) => setSlot({ ...slot, startTime: e.target.value })} required /></Field>
            <Field label="To"><input type="time" value={slot.endTime} onChange={(e) => setSlot({ ...slot, endTime: e.target.value })} required /></Field>
            <button className="btn primary" disabled={!lengthOk}><Icon name="plus" size={18} />Add</button>
          </form>
          <small className={lengthOk ? 'muted' : 'bad-text'}>{lengthOk ? `${minutes} minutes` : 'A slot must last between 30 and 120 minutes.'}</small>
          {slotErr && <ErrorNote>{slotErr}</ErrorNote>}
        </section>
      </div>
    </div>
  );
}
