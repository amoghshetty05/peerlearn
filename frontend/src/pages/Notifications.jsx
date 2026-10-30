import { api } from '../api.js';
import { useLoad } from '../state.jsx';
import { ago } from '../format.js';
import Icon from '../components/Icon.jsx';
import { Empty, ErrorNote, Spinner } from '../components/ui.jsx';

export default function Notifications() {
  const { data, error, loading, reload } = useLoad('/notifications');
  const refresh = () => { window.dispatchEvent(new Event('peerlearn:notifications')); reload(); };
  const read = async (n) => { if (!n.read) { await api.patch(`/notifications/${n.id}`).catch(() => {}); refresh(); } };
  const readAll = async () => { await api.post('/notifications/read-all').catch(() => {}); refresh(); };

  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  const unread = data.filter((n) => !n.read).length;

  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Alerts</h1><p className="muted">{unread ? `${unread} unread` : 'You are all caught up.'}</p></div>
        {unread > 0 && <button className="btn ghost" onClick={readAll}><Icon name="check" size={18} />Mark all read</button>}</header>
      {data.length === 0 ? <Empty icon="bell" title="No alerts yet">Requests, replies and reminders will appear here.</Empty>
        : <ul className="alerts">{data.map((n) => (
          <li key={n.id} className={n.read ? '' : 'unread'}><button onClick={() => read(n)}><i aria-hidden="true" /><span>{n.message}</span><time>{ago(n.createdAt)}</time></button></li>))}</ul>}
    </div>
  );
}
