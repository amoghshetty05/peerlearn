import { useEffect, useState } from 'react';
import { api, friendly, session } from '../api.js';
import { useAuth, useToast } from '../state.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, ErrorNote, Field, Spinner } from '../components/ui.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');

  useEffect(() => { api.get('/users/me').then((m) => { setMe(m); setForm({ name: m.name, phone: m.phone || '' }); }).catch((e) => setError(friendly(e))); }, []);
  if (!me) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      const updated = await api.put('/users/me', { name: form.name.trim(), phone: form.phone.trim() || null });
      setMe(updated); session.save(session.token(), { ...user, name: updated.name }); toast('Profile saved. Refresh to see your new name in the menu.');
    } catch (err) { setError(friendly(err)); }
  };

  return (
    <div className="page narrow">
      <header className="page-head"><div className="row gap"><Avatar name={me.name} size={56} /><div><h1>{me.name}</h1><span className="level">{me.role}</span></div></div></header>
      <form className="card stack" onSubmit={save}>
        <Field label="Name"><input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Email" hint="Your email cannot be changed."><input value={me.email} disabled /></Field>
        <Field label="Phone" hint="Only shown to people you have an accepted session with, and to moderators."><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98450 12345" /></Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="row between"><button type="button" className="btn ghost" onClick={() => logout()}><Icon name="logout" size={18} />Log out</button><button className="btn primary" disabled={!form.name.trim()}>Save changes</button></div>
      </form>
    </div>
  );
}
