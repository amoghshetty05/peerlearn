// CMP-01 talks only to the API layer. Every error code becomes a plain message here (SAD 3.4).
const TOKEN_KEY = 'peerlearn.token';
const USER_KEY = 'peerlearn.user';

export class ApiError extends Error {
  constructor(status, code, message, requestId) {
    super(message);
    Object.assign(this, { status, code, requestId });
  }
}

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  save: (token, user) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

const FALLBACK = {
  VALIDATION_ERROR: 'Please check what you entered and try again.',
  UNAUTHENTICATED: 'Please log in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'Your account is not allowed to do this.',
  ACCOUNT_SUSPENDED: 'This account has been suspended by a moderator.',
  NOT_FOUND: 'We could not find that.',
  CONFLICT: 'That conflicts with something that already exists.',
  SLOT_OVERLAP: 'This slot overlaps one you already have.',
  GROUP_FULL: 'This study group is full.',
  ACCOUNT_LOCKED: 'Too many failed logins. Try again in 15 minutes.',
  RATE_LIMITED: 'You are going a bit fast. Wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

export const friendly = (err) => {
  if (!(err instanceof ApiError)) return 'We could not reach PeerLearn. Check your connection and try again.';
  if (err.code === 'INTERNAL_ERROR' || err.code === 'RATE_LIMITED') return `${FALLBACK[err.code]}${err.requestId ? ` (ref ${err.requestId})` : ''}`;
  return err.message || FALLBACK[err.code] || FALLBACK.INTERNAL_ERROR;
};

async function request(method, path, body) {
  const token = session.token();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('network'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, data.code || 'INTERNAL_ERROR', data.message, data.requestId);
    const sessionLost = token && res.status === 401 && ['TOKEN_EXPIRED', 'UNAUTHENTICATED'].includes(err.code) && !path.startsWith('/auth/login');
    const suspended = token && err.code === 'ACCOUNT_SUSPENDED';
    if (sessionLost || suspended) window.dispatchEvent(new CustomEvent('peerlearn:logout', { detail: err }));
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b ?? {}),
  del: (p) => request('DELETE', p),
};
