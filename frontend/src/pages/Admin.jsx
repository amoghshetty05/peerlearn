import { useState } from 'react';
import { api, friendly } from '../api.js';
import { useLoad, useToast } from '../state.jsx';
import { ago } from '../format.js';
import Icon from '../components/Icon.jsx';
import { Avatar, Empty, ErrorNote, Spinner, StatusBadge } from '../components/ui.jsx';

export default function Admin() {
  const toast = useToast();
  const [filter, setFilter] = useState('open');
  const { data, error, loading, reload } = useLoad(`/admin/reports${filter === 'all' ? '' : `?status=${filter}`}`);

  const act = async (r, action) => {
    if (action === 'suspend' && !window.confirm(`Suspend ${r.reportedName}? They will be logged out and unable to log in.`)) return;
    try { await api.patch(`/admin/reports/${r.id}`, { action }); toast(action === 'dismiss' ? 'Report dismissed.' : action === 'warn' ? `${r.reportedName} was warned.` : `${r.reportedName} was suspended.`); reload(); }
    catch (e) { toast(friendly(e), 'bad'); reload(); }
  };

  return (
    <div className="page">
      <header className="page-head"><div><h1>Reports</h1><p className="muted">Review what users have flagged. Every action here is recorded in the audit log.</p></div></header>
      <div className="seg tabs" role="tablist">
        {[['open', 'Open'], ['all', 'All'], ['dismissed', 'Dismissed'], ['warned', 'Warned'], ['suspended', 'Suspended']].map(([k, l]) =>
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {loading ? <Spinner /> : error ? <ErrorNote onRetry={reload}>{error}</ErrorNote> : data.length === 0
        ? <Empty icon="shield" title="No reports here">Nothing needs your attention.</Empty>
        : <ul className="list">{data.map((r) => (
          <li key={r.id} className="report">
            <Avatar name={r.reportedName} />
            <div className="session-main">
              <div className="session-title"><b>{r.reportedName}</b><StatusBadge status={r.status} />{r.reportedStatus === 'suspended' && <span className="chip warn">account suspended</span>}{r.reportedWarnings > 0 && <span className="chip">{r.reportedWarnings} earlier warning{r.reportedWarnings > 1 ? 's' : ''}</span>}</div>
              <p className="reason">{r.reason}</p>
              <div className="muted small">Reported by {r.reporterName} · {ago(r.createdAt)}</div>
              {r.status === 'open' && (
                <div className="row gap wrap">
                  <button className="btn ghost sm" onClick={() => act(r, 'dismiss')}>Dismiss</button>
                  <button className="btn warn sm" onClick={() => act(r, 'warn')}>Warn</button>
                  <button className="btn danger sm" onClick={() => act(r, 'suspend')}><Icon name="shield" size={16} />Suspend</button>
                </div>)}
            </div>
          </li>))}</ul>}
    </div>
  );
}
