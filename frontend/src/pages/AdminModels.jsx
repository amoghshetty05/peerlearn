// Admin page: the six Smart Match models (FR-16, NFR-09) and how they scored on the same test data.
import { useLoad } from '../state.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorNote, Spinner } from '../components/ui.jsx';

const pct = (v) => `${(v * 100).toFixed(1)}%`;

function Auc({ value, best }) {
  // ROC-AUC bar drawn from 0.5 (guessing) to 1.0 (perfect)
  const w = Math.max(0, Math.min(1, (value - 0.5) / 0.5)) * 100;
  return (
    <span className="auc"><i><u className={best ? 'best' : ''} style={{ width: `${w}%` }} /></i><b>{value.toFixed(3)}</b></span>
  );
}

export default function AdminModels() {
  const { data, error, loading, reload } = useLoad('/admin/models');
  if (loading) return <Spinner />;
  if (error) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;

  const rows = [...data.models].sort((a, b) => b.roc_auc - a.roc_auc);
  const best = rows[0]?.key;
  const all = [...rows, { ...data.baseline, family: 'Baseline', name: 'Rule-based score (FR-06)' }];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Smart Match models</h1>
          <p className="muted">Six models predict the chance that a session succeeds (the Tutor accepts and it is rated 4 or 5). All are scored on the same {data.dataset.test_rows.toLocaleString()} test sessions. ROC-AUC: 0.5 is guessing, 1.0 is perfect.</p>
        </div>
      </header>

      <div className="card">
        <table className="models">
          <thead>
            <tr><th>Model</th><th className="num">Accuracy</th><th className="num wide">Precision</th><th className="num wide">Recall</th><th className="num">F1</th><th>ROC-AUC</th></tr>
          </thead>
          <tbody>
            {all.map((m) => (
              <tr key={m.key} className={m.family === 'Baseline' ? 'baseline' : ''}>
                <td>
                  <b>{m.name}</b>{m.key === data.default && <span className="in-use"><Icon name="check" size={13} />In use</span>}
                  <small className="muted">{m.family}</small>
                </td>
                <td className="num">{pct(m.accuracy)}</td>
                <td className="num wide">{pct(m.precision)}</td>
                <td className="num wide">{pct(m.recall)}</td>
                <td className="num">{m.f1.toFixed(3)}</td>
                <td><Auc value={m.roc_auc} best={m.key === best} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted small note">
        Training data: {data.dataset.rows.toLocaleString()} simulated sessions (seed {data.dataset.seed}), because PeerLearn has no real usage history yet, so these scores compare the models; they are not real-world accuracy. Quantum models use 4 qubits on a simulator and {rows.find((m) => m.family === 'Quantum')?.train_rows ?? 400} training rows. Every training run is recorded in MLflow (ml/mlflow.db).
      </p>
    </div>
  );
}
