import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, friendly } from '../api.js';
import { useToast } from '../state.jsx';
import { cap, dateTime, timeLeft } from '../format.js';
import Icon from './Icon.jsx';
import { Avatar, StatusBadge, Stars } from './ui.jsx';

export default function SessionItem({ s, me, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const other = s.counterpart;
  const isTutor = me.role === 'tutor';

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast(okMsg); window.dispatchEvent(new Event('peerlearn:notifications')); onChange(); }
    catch (e) { toast(friendly(e), 'bad'); onChange(); } finally { setBusy(false); }
  };
  const answer = (status) => act(() => api.patch(`/sessions/${s.id}`, { status }), status === 'accepted' ? 'Accepted. Contact details are now shared.' : 'Declined.');
  const rate = () => act(() => api.post(`/sessions/${s.id}/rating`, { score, ...(comment.trim() ? { comment: comment.trim() } : {}) }), 'Thanks for rating!');

  return (
    <li className="session">
      <Avatar name={other.name} />
      <div className="session-main">
        <div className="session-title">
          <b>{cap(s.subject)}</b>
          <span className="muted">with</span>
          <Link to={`/users/${other.id}`} className="plain">{other.name}</Link>
          <StatusBadge status={s.status} />
        </div>
        <div className="muted small">{s.topic}</div>
        <div className="session-when"><Icon name="clock" size={15} />{dateTime(s.slotTime)}
          {s.status === 'pending' && <span className="chip warn">{isTutor ? `Reply in ${timeLeft(s.expiresAt).replace(' left', '')}` : `Waiting · ${timeLeft(s.expiresAt)}`}</span>}
        </div>
        {other.email && (
          <div className="contact">
            <a href={`mailto:${other.email}`}><Icon name="mail" size={15} />{other.email}</a>
            {other.phone && <a href={`tel:${other.phone.replace(/\s/g, '')}`}><Icon name="phone" size={15} />{other.phone}</a>}
          </div>
        )}
        {isTutor && s.status === 'pending' && (
          <div className="row gap">
            <button className="btn primary sm" disabled={busy} onClick={() => answer('accepted')}><Icon name="check" size={16} />Accept</button>
            <button className="btn ghost sm" disabled={busy} onClick={() => answer('declined')}>Decline</button>
          </div>
        )}
        {!isTutor && s.status === 'completed' && !s.rated && (
          <div className="rate">
            <Stars value={score} onChange={setScore} size={24} />
            <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="Add a comment (optional)" aria-label="Comment" />
            <button className="btn primary sm" disabled={busy || !score} onClick={rate}>Send rating</button>
          </div>
        )}
        {!isTutor && s.status === 'completed' && s.rated && <div className="muted small">You rated this session.</div>}
      </div>
    </li>
  );
}
