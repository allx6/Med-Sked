import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Users', to: '/users' },
  { label: 'Relationships', to: '/relationships' },
  { label: 'Audit Logs', to: '/audit-logs' },
  { label: 'Profile', to: '/profile' },
];

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const auth = getStoredAuth();

  const handleLogout = () => {
    localStorage.removeItem('medsked-admin-auth');
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <div className="brand-title">MedSked</div>
            <div className="brand-subtitle">Admin</div>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">{auth?.user?.username || 'Admin'}</div>
          <button className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="content-panel">{children}</main>
    </div>
  );
}
