import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, friendly } from '../api.js';
import { useAuth, useToast } from '../state.jsx';
import { Brand } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorNote, Field } from '../components/ui.jsx';

const ROLES = [
  ['learner', 'search', 'I need help', 'Ask for a tutor in any subject.'],
  ['tutor', 'book', 'I can tutor', 'Offer subjects and set your weekly hours.'],
];

export default function Register() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', role: 'learner' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const emailOk = /^[^@\s]+@pes\.edu$/i.test(f.email.trim());

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/auth/register', { name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role, ...(f.phone.trim() ? { phone: f.phone.trim() } : {}) });
      await login(f.email.trim(), f.password);
      toast('Welcome to PeerLearn!');
      nav(f.role === 'tutor' ? '/schedule' : '/find', { replace: true });
    } catch (err) { setError(friendly(err)); setBusy(false); }
  };

  return (
    <div className="auth single">
      <section className="auth-form">
        <form onSubmit={submit} className="stack" noValidate>
          <Brand />
          <h2>Create your account</h2>
          <div className="role-pick" role="radiogroup" aria-label="How will you use PeerLearn?">
            {ROLES.map(([value, icon, title, text]) => (
              <button type="button" role="radio" aria-checked={f.role === value} key={value} className={f.role === value ? 'on' : ''} onClick={() => setF({ ...f, role: value })}>
                <Icon name={icon} /><b>{title}</b><small>{text}</small>
              </button>
            ))}
          </div>
          <Field label="Full name"><input value={f.name} onChange={set('name')} maxLength={100} autoComplete="name" required /></Field>
          <Field label="PES email" hint={f.email && !emailOk ? 'Use your @pes.edu address.' : ''}><input type="email" value={f.email} onChange={set('email')} placeholder="you@pes.edu" autoComplete="username" required /></Field>
          <Field label="Password" hint="At least 8 characters."><input type="password" value={f.password} onChange={set('password')} minLength={8} maxLength={72} autoComplete="new-password" required /></Field>
          <Field label="Phone (optional)" hint="Shared only with people whose session you accept or request."><input type="tel" value={f.phone} onChange={set('phone')} placeholder="+91 98450 12345" autoComplete="tel" /></Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn primary lg" disabled={busy || !f.name.trim() || !emailOk || f.password.length < 8}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="muted center">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </section>
    </div>
  );
}
