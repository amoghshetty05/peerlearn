import { useState } from 'react';
import { api, friendly } from '../api.js';
import { useToast } from '../state.jsx';
import { Modal, Field, ErrorNote } from './ui.jsx';

export default function ReportDialog({ target, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/reports', { reportedId: target.id, reason }); toast('Report sent to the moderators.'); onClose(); }
    catch (err) { setError(friendly(err)); setBusy(false); }
  };
  return (
    <Modal title={`Report ${target.name}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p className="muted">Tell the moderators what happened. They will review it and may warn or suspend the account.</p>
        <Field label="What happened?" hint={`${reason.length}/500`}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} required minLength={3} autoFocus />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="row end"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={busy || reason.trim().length < 3}>{busy ? 'Sending…' : 'Send report'}</button></div>
      </form>
    </Modal>
  );
}
