import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { friendly } from '../api.js';
import { useAuth } from '../state.jsx';
import { Brand } from '../components/Layout.jsx';
import { ErrorNote, Field } from '../components/ui.jsx';

export default function Login() {
  const { login, notice } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email.trim(), password); nav(loc.state?.from || '/', { replace: true }); }
    catch (err) { setError(friendly(err)); setBusy(false); }
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <Brand light />
        <div>
          <h1>Stuck on a topic?<br />Someone on campus <mark>already got it.</mark></h1>
          <p>Find a PES student who knows your subject, book a slot that fits your timetable, and study together.</p>
        </div>
        <ul className="art-points"><li>Matched by subject, time and level</li><li>Contact details shared only after a tutor says yes</li><li>Free, for PES students</li></ul>
      </section>
      <section className="auth-form">
        <form onSubmit={submit} className="stack" noValidate>
          <div className="show-mobile"><Brand /></div>
          <h2>Welcome back</h2>
          {notice && <div className="note info">{notice}</div>}
          <Field label="PES email"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pes.edu" required autoFocus /></Field>
          <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button className="btn primary lg" disabled={busy || !email || !password}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p className="muted center">New here? <Link to="/register">Create an account</Link></p>
        </form>
      </section>
    </div>
  );
}
