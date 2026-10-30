import { useState } from 'react';
import { api, friendly } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { cap } from '../format.js';
import Icon from '../components/Icon.jsx';
import { Empty, ErrorNote, Field, Modal, Spinner } from '../components/ui.jsx';

function CreateDialog({ onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', subject: '', maxSize: 5 });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api.post('/groups', { ...(f.name.trim() ? { name: f.name.trim() } : {}), subject: f.subject.trim(), maxSize: Number(f.maxSize) }); toast('Study group created.'); onDone(); onClose(); }
    catch (err) { setError(friendly(err)); }
  };
  return (
    <Modal title="New study group" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Group name (optional)"><input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Calculus crew" autoFocus /></Field>
        <Field label="Subject"><input value={f.subject} maxLength={60} onChange={(e) => setF({ ...f, subject: e.target.value })} required /></Field>
        <Field label={`Maximum members: ${f.maxSize}`}><input type="range" min="3" max="10" value={f.maxSize} onChange={(e) => setF({ ...f, maxSize: e.target.value })} /></Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="row end"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!f.subject.trim()}>Create group</button></div>
      </form>
    </Modal>
  );
}

export default function Groups() {
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const [members, setMembers] = useState([]);
  const { data, error, loading, reload } = useLoad(`/groups${filter.trim() ? `?subject=${encodeURIComponent(filter.trim())}` : ''}`);

  const toggle = async (g) => {
    try { await (g.joined ? api.del(`/groups/${g.id}/join`) : api.post(`/groups/${g.id}/join`)); toast(g.joined ? 'You left the group.' : 'You joined the group.'); reload(); if (open === g.id) show(g.id, true); }
    catch (e) { toast(friendly(e), 'bad'); reload(); }
  };
  const show = async (id, force) => {
    if (open === id && !force) { setOpen(null); return; }
    try { setMembers((await api.get(`/groups/${id}`)).members); setOpen(id); } catch (e) { toast(friendly(e), 'bad'); }
  };

  return (
    <div className="page">
      <header className="page-head"><div><h1>Study groups</h1><p className="muted">Small groups for one subject. Join until the group is full.</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} />New group</button></header>
      <div className="search"><Icon name="search" size={18} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by subject" aria-label="Filter by subject" /></div>
      {loading ? <Spinner /> : error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : data.length === 0
        ? <Empty icon="users" title="No groups yet">Be the first to start one for your subject.</Empty>
        : <ul className="groups">{data.map((g) => {
          const full = g.memberCount >= g.maxSize;
          return (
            <li key={g.id} className="group">
              <div className="group-main">
                <h3>{g.name || `${cap(g.subject)} group`}</h3>
                <div className="muted small">{cap(g.subject)} · started by {g.ownerName}</div>
                <div className="seats" aria-label={`${g.memberCount} of ${g.maxSize} seats taken`}>
                  {Array.from({ length: g.maxSize }, (_, i) => <i key={i} className={i < g.memberCount ? 'on' : ''} />)}<span>{g.memberCount}/{g.maxSize}</span>
                </div>
                {open === g.id && <ul className="members">{members.length ? members.map((m) => <li key={m.id}>{m.name}<small>{m.role}</small></li>) : <li className="muted">No members yet.</li>}</ul>}
              </div>
              <div className="group-actions">
                <button className="btn ghost sm" onClick={() => show(g.id)}>{open === g.id ? 'Hide' : 'Members'}</button>
                {g.joined ? <button className="btn ghost sm" onClick={() => toggle(g)}>Leave</button>
                  : <button className="btn primary sm" disabled={full} onClick={() => toggle(g)}>{full ? 'Full' : 'Join'}</button>}
              </div>
            </li>);
        })}</ul>}
      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={reload} />}
    </div>
  );
}
