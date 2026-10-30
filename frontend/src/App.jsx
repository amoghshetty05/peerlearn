import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './state.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FindTutor from './pages/FindTutor.jsx';
import Matches from './pages/Matches.jsx';
import Sessions from './pages/Sessions.jsx';
import Schedule from './pages/Schedule.jsx';
import Groups from './pages/Groups.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';
import UserProfile from './pages/UserProfile.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={user?.role === 'admin' ? <Navigate to="/admin" replace /> : <Dashboard />} />
        <Route path="find" element={<Protected roles={['learner']}><FindTutor /></Protected>} />
        <Route path="requests/:id/matches" element={<Protected roles={['learner']}><Matches /></Protected>} />
        <Route path="schedule" element={<Protected roles={['tutor']}><Schedule /></Protected>} />
        <Route path="sessions" element={<Protected roles={['learner', 'tutor']}><Sessions /></Protected>} />
        <Route path="groups" element={<Protected roles={['learner', 'tutor']}><Groups /></Protected>} />
        <Route path="notifications" element={<Protected roles={['learner', 'tutor']}><Notifications /></Protected>} />
        <Route path="users/:id" element={<UserProfile />} />
        <Route path="me" element={<Profile />} />
        <Route path="admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
