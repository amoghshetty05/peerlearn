import { useEffect } from 'react';
import Icon from './Icon.jsx';

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export const Empty = ({ icon = 'book', title, children }) => (
  <div className="empty"><Icon name={icon} size={28} /><h3>{title}</h3>{children && <p>{children}</p>}</div>
);

export const ErrorNote = ({ children, onRetry }) => (
  <div className="note error" role="alert">
    <span>{children}</span>{onRetry && <button className="link" onClick={onRetry}>Try again</button>}
  </div>
);

export function Stars({ value = 0, onChange, size = 20 }) {
  return (
    <span className={`stars ${onChange ? 'input' : ''}`} aria-label={onChange ? 'Choose a rating' : `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Icon name="star" size={size} fill={n <= Math.round(value)} />;
        return onChange
          ? <button type="button" key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>{star}</button>
          : <span key={n} className={n <= Math.round(value) ? 'on' : ''}>{star}</span>;
      })}
    </span>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

export const StatusBadge = ({ status }) => <span className={`badge ${status}`}>{status}</span>;
export const Avatar = ({ name, size = 40 }) => (
  <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
    {(name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
  </span>
);

export const Field = ({ label, hint, children }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
);
