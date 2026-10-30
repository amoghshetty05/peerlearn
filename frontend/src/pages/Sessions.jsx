import { useState } from 'react';
import { useAuth, useLoad } from '../state.jsx';
import SessionItem from '../components/SessionItem.jsx';
import { Empty, ErrorNote, Spinner } from '../components/ui.jsx';

const FILTERS = [
  ['all', 'All', () => true],
  ['pending', 'Pending', (s) => s.status === 'pending'],
  ['accepted', 'Accepted', (s) => s.status === 'accepted'],
  ['past', 'Past', (s) => ['completed', 'declined', 'expired'].includes(s.status)],
];

export default function Sessions() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad('/sessions');
  const [filter, setFilter] = useState('all');
  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  const shown = data.filter(FILTERS.find(([k]) => k === filter)[2]);

  return (
    <div className="page">
      <header className="page-head"><div><h1>Sessions</h1><p className="muted">Every session you have asked for or been asked for.</p></div></header>
      <div className="seg tabs" role="tablist">
        {FILTERS.map(([k, label, fn]) => <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}<small>{data.filter(fn).length}</small></button>)}
      </div>
      {shown.length === 0
        ? <Empty icon="calendar" title="Nothing here yet">Sessions will show up as soon as they are requested.</Empty>
        : <ul className="list">{shown.map((s) => <SessionItem key={s.id} s={s} me={user} onChange={reload} />)}</ul>}
    </div>
  );
}
