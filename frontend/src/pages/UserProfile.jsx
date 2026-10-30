import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth, useLoad } from '../state.jsx';
import { cap, DAYS, time12 } from '../format.js';
import Icon from '../components/Icon.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { Avatar, ErrorNote, Spinner, Stars } from '../components/ui.jsx';

export default function UserProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad(`/users/${id}`);
  const [reporting, setReporting] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  const p = data;
  const self = p.id === user.id;

  return (
    <div className="page narrow">
      <header className="page-head"><div className="row gap"><Avatar name={p.name} size={64} /><div><h1>{p.name}</h1><span className="level">{p.role}</span></div></div>
        {!self && user.role !== 'admin' && <button className="btn ghost" onClick={() => setReporting(true)}><Icon name="flag" size={18} />Report</button>}</header>

      <section className="card stack">
        <h2>Contact</h2>
        {p.email
          ? <div className="contact big"><a href={`mailto:${p.email}`}><Icon name="mail" size={18} />{p.email}</a>{p.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`}><Icon name="phone" size={18} />{p.phone}</a>}</div>
          : <div className="locked"><Icon name="lock" size={20} /><span>Email and phone unlock once a tutor accepts a session between you.</span></div>}
      </section>

      {p.role === 'tutor' && (
        <>
          <section className="card stack">
            <div className="row between"><h2>Rating</h2>{p.rating.count ? <span className="row gap"><Stars value={p.rating.average} /><b>{p.rating.average.toFixed(1)}</b><span className="muted">({p.rating.count})</span></span> : <span className="muted">No ratings yet</span>}</div>
          </section>
          <section className="card stack"><h2>Teaches</h2>
            {p.subjects.length ? <ul className="rows">{p.subjects.map((s) => <li key={s.id}><b>{cap(s.subject)}</b><span className={`level ${s.proficiency}`}>{s.proficiency}</span></li>)}</ul> : <p className="muted">No subjects listed.</p>}
          </section>
          <section className="card stack"><h2>Weekly availability</h2>
            {p.availability.length ? <ul className="rows">{p.availability.map((s) => <li key={s.id}><b>{DAYS[s.weekday]}</b><span>{time12(s.startTime)} – {time12(s.endTime)}</span></li>)}</ul> : <p className="muted">No slots set.</p>}
          </section>
        </>
      )}
      {reporting && <ReportDialog target={p} onClose={() => setReporting(false)} />}
    </div>
  );
}
