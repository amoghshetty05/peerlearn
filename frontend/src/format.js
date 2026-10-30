const TZ = 'Asia/Kolkata';
export const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const dateTime = (iso) => new Date(iso).toLocaleString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
export const dayDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const clockTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
export const time12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

export function timeLeft(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3.6e6);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.floor(ms / 6e4))}m left`;
}

export function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// value for <input type="datetime-local"> in campus time, `hours` from now rounded to the next half hour
export function defaultPreferred(hours = 24) {
  const t = new Date(Date.now() + hours * 3.6e6 + 330 * 6e4);
  t.setUTCMinutes(t.getUTCMinutes() >= 30 ? 60 : 30, 0, 0);
  return t.toISOString().slice(0, 16);
}
export const localInputToIso = (v) => `${v}:00+05:30`;
