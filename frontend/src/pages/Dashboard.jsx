import { Link } from 'react-router-dom';
import { useAuth, useLoad } from '../state.jsx';
import Icon from '../components/Icon.jsx';
import SessionItem from '../components/SessionItem.jsx';
import { Empty, ErrorNote, Spinner, Stars } from '../components/ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useLoad('/dashboard');
  const first = user.name.split(' ')[0];
  const tutor = user.role === 'tutor';

  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Hi, {first}</h1><p className="muted">{tutor ? 'Here is what is happening with your tutoring.' : 'Here is what is coming up for you.'}</p></div>
        {tutor
          ? <Link to="/schedule" className="btn primary"><Icon name="clock" size={18} />Edit my schedule</Link>
          : <Link to="/find" className="btn primary"><Icon name="search" size={18} />Find a tutor</Link>}
      </header>

      <div className="stats">
        <div className="stat"><span>Upcoming</span><b>{data.upcomingSessions.length}</b></div>
        <div className="stat"><span>{tutor ? 'Need your answer' : 'Waiting for reply'}</span><b>{data.pendingRequests.length}</b></div>
        {tutor
          ? <div className="stat"><span>Your rating</span><b>{data.rating.count ? data.rating.average.toFixed(1) : '–'}</b>{data.rating.count > 0 && <Stars value={data.rating.average} size={14} />}<small>{data.rating.count} rating{data.rating.count === 1 ? '' : 's'}</small></div>
          : <div className="stat"><span>Unread alerts</span><b>{data.unreadNotifications}</b></div>}
      </div>

      <section>
        <h2>{tutor ? 'Requests waiting for you' : 'Waiting for a reply'}</h2>
        {data.pendingRequests.length === 0
          ? <Empty icon="check" title="Nothing pending">{tutor ? 'New session requests will show up here.' : 'Sessions you ask for appear here until the tutor answers.'}</Empty>
          : <ul className="list">{data.pendingRequests.map((s) => <SessionItem key={s.id} s={s} me={user} onChange={reload} />)}</ul>}
      </section>

      <section>
        <h2>Upcoming sessions</h2>
        {data.upcomingSessions.length === 0
          ? <Empty icon="calendar" title="No sessions booked">{tutor ? 'Accepted sessions will appear here.' : <>Ask a tutor for help and your sessions will show here. <Link to="/find">Find a tutor</Link></>}</Empty>
          : <ul className="list">{data.upcomingSessions.map((s) => <SessionItem key={s.id} s={s} me={user} onChange={reload} />)}</ul>}
      </section>

      {!tutor && data.toRate?.length > 0 && (
        <section>
          <h2>How did it go?</h2>
          <ul className="list">{data.toRate.map((s) => <SessionItem key={s.id} s={s} me={user} onChange={reload} />)}</ul>
        </section>
      )}
    </div>
  );
}
