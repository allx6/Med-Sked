import { useNavigate } from 'react-router-dom';

const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('medsked-admin-auth');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const user = auth?.user;

  const handleLogout = () => {
    localStorage.removeItem('medsked-admin-auth');
    navigate('/login', { replace: true });
  };

  return (
    <div className="page-stack">
      <div className="panel page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h2>Profile</h2>
        </div>
      </div>

      <div className="panel">
        <div className="detail-grid">
          <div>
            <span>Username</span>
            <strong>{user?.username || 'Unavailable'}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{user?.email || 'Unavailable'}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unavailable'}</strong>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button type="button" className="logout-button" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
