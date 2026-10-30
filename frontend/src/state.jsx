import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, session, friendly } from './api.js';

const AuthCtx = createContext(null);
const ToastCtx = createContext(() => {});

export const useAuth = () => useContext(AuthCtx);
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }) {
  const [user, setUser] = useState(session.user());
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const logout = useCallback(async (message = '') => {
    try { if (session.token()) await api.post('/auth/logout'); } catch { /* token already invalid */ }
    session.clear(); setUser(null); setNotice(message);
  }, []);

  useEffect(() => {
    const onLost = (e) => { session.clear(); setUser(null); setNotice(friendly(e.detail)); };
    window.addEventListener('peerlearn:logout', onLost);
    return () => window.removeEventListener('peerlearn:logout', onLost);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    session.save(res.token, res.user); setUser(res.user); setNotice('');
    return res.user;
  };

  const show = useCallback((message, kind = 'ok') => {
    setToast({ message, kind, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, login, logout, notice, setNotice }}>
      <ToastCtx.Provider value={show}>
        {children}
        {toast && <div className={`toast ${toast.kind}`} role="status" key={toast.id}>{toast.message}</div>}
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}

// Tiny data hook: { data, error, loading, reload }
export function useLoad(path, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(async () => {
    try { set((s) => ({ ...s, error: null })); set({ data: await api.get(path), error: null, loading: false }); }
    catch (e) { set({ data: null, error: friendly(e), loading: false }); }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload };
}
