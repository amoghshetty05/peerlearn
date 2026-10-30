import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state.jsx';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';

const NAV = {
  learner: [['/', 'home', 'Home'], ['/find', 'search', 'Find a tutor'], ['/sessions', 'calendar', 'Sessions'], ['/groups', 'users', 'Groups'], ['/notifications', 'bell', 'Alerts']],
  tutor: [['/', 'home', 'Home'], ['/schedule', 'clock', 'Schedule'], ['/sessions', 'calendar', 'Sessions'], ['/groups', 'users', 'Groups'], ['/notifications', 'bell', 'Alerts']],
  admin: [['/admin', 'shield', 'Reports']],
};

export const Brand = ({ light }) => (
  <span className={`brand ${light ? 'light' : ''}`}>
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill={light ? '#fff' : 'var(--navy)'} fillOpacity={light ? 0.1 : 1} />
      <circle cx="12" cy="16" r="6" fill="var(--mark)" /><circle cx="20" cy="16" r="6" fill="none" stroke="#fff" strokeWidth="2.5" /></svg>
    <b>PeerLearn</b>
  </span>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const items = NAV[user.role];

  useEffect(() => {
    if (user.role === 'admin') return undefined;
    let live = true;
    const poll = () => api.get('/notifications?unread=true').then((n) => live && setUnread(n.length)).catch(() => {});
    poll(); const t = setInterval(poll, 30000);
    window.addEventListener('peerlearn:notifications', poll);
    return () => { live = false; clearInterval(t); window.removeEventListener('peerlearn:notifications', poll); };
  }, [user.role]);

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="side-brand"><Brand light /></Link>
        <nav aria-label="Main">
          {items.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav-item">
              <Icon name={icon} /><span>{label}</span>{label === 'Alerts' && unread > 0 && <em className="dot-count">{unread}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <NavLink to="/me" className="who"><Avatar name={user.name} size={36} /><span><b>{user.name}</b><small>{user.role}</small></span></NavLink>
          <button className="icon-btn light" onClick={() => logout()} aria-label="Log out" title="Log out"><Icon name="logout" /></button>
        </div>
      </aside>
      <header className="topbar">
        <Link to="/"><Brand /></Link>
        <div className="row">
          {user.role !== 'admin' && <Link to="/notifications" className="icon-btn" aria-label="Alerts"><Icon name="bell" />{unread > 0 && <em className="dot-count">{unread}</em>}</Link>}
          <Link to="/me" className="icon-btn" aria-label="Your profile"><Avatar name={user.name} size={32} /></Link>
        </div>
      </header>
      <main className="main"><Outlet /></main>
      <nav className="tabbar" aria-label="Main">
        {items.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className="tab"><Icon name={icon} size={22} /><span>{label.replace('Find a tutor', 'Find')}</span></NavLink>
        ))}
        {user.role === 'admin' && <button className="tab" onClick={() => logout()}><Icon name="logout" size={22} /><span>Log out</span></button>}
      </nav>
    </div>
  );
}
