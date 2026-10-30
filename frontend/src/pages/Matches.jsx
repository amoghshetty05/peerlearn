import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, friendly } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { dayDate, clockTime, DAYS_SHORT, time12 } from '../format.js';
import ScoreRing from '../components/ScoreRing.jsx';
import Icon from '../components/Icon.jsx';
import { Empty, ErrorNote, Spinner, Stars } from '../components/ui.jsx';

function Bar({ label, value, max }) {
  return (
    <div className="bar"><span>{label}</span><i><u style={{ width: `${(value / max) * 100}%` }} /></i><b>{value}<small>/{max}</small></b></div>
  );
}

export default function Matches() {
  const { id } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(`/requests/${id}/matches`);
  const [booked, setBooked] = useState({});   // `${tutorId}:${iso}` -> true
  const [busy, setBusy] = useState('');

  const book = async (tutorId, iso, name) => {
    const key = `${tutorId}:${iso}`; setBusy(key);
    try {
      await api.post('/sessions', { requestId: Number(id), tutorId, slotTime: iso });
      setBooked((b) => ({ ...b, [key]: true }));
      toast(`Request sent to ${name}. They have 48 hours to reply.`);
    } catch (e) { toast(friendly(e), 'bad'); } finally { setBusy(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Your best matches</h1><p className="muted">Top {data.matches.length || 5} tutors by score. Tap a time to ask for that slot.</p></div>
        <Link to="/find" className="btn ghost">New search</Link>
      </header>
      {data.matches.length === 0
        ? <Empty icon="search" title="No tutors teach this subject yet">Try a broader subject name, or check back later as more tutors join.</Empty>
        : <ol className="matches">{data.matches.map((m, i) => (
          <li key={m.tutorId} className="match">
            <div className="match-score"><span className="rank">#{i + 1}</span><ScoreRing score={m.score} /></div>
            <div className="match-body">
              <div className="match-head">
                <div>
                  <h3><Link to={`/users/${m.tutorId}`} className="plain">{m.name}</Link></h3>
                  <div className="row gap small"><span className={`level ${m.proficiency}`}>{m.proficiency}</span>
                    {m.rating.count > 0 ? <span className="row"><Stars value={m.rating.average} size={14} /><span className="muted">{m.rating.average.toFixed(1)} ({m.rating.count})</span></span> : <span className="muted">No ratings yet</span>}</div>
                </div>
              </div>
              <div className="bars">
                <Bar label="Subject" value={m.breakdown.subject} max={50} />
                <Bar label="Time fit" value={m.breakdown.availability} max={30} />
                <Bar label="Level" value={m.breakdown.proficiency} max={20} />
                {m.breakdown.ratingBonus > 0 && <div className="bonus">+{m.breakdown.ratingBonus} rating bonus</div>}
              </div>
              <div className="slots">
                <span className="muted small">Available weekly: {m.availableSlots.map((s) => `${DAYS_SHORT[s.weekday]} ${time12(s.startTime)}–${time12(s.endTime)}`).join(', ') || 'no slots set'}</span>
                <div className="chips">
                  {m.availableSlots.flatMap((s) => s.upcoming.map((iso) => ({ iso, s }))).sort((a, b) => a.iso.localeCompare(b.iso)).slice(0, 6).map(({ iso }) => {
                    const key = `${m.tutorId}:${iso}`;
                    return booked[key]
                      ? <span className="chip done" key={key}><Icon name="check" size={14} />Requested</span>
                      : <button className="chip slot" key={key} disabled={busy === key} onClick={() => book(m.tutorId, iso, m.name)}>{dayDate(iso)} · {clockTime(iso)}</button>;
                  })}
                </div>
              </div>
            </div>
          </li>))}</ol>}
    </div>
  );
}
