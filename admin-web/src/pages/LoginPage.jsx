import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import medskedLogo from '../assets/medsked.png';
import { loginAdmin } from '../services/api';

const markActiveSession = () => {
  try {
    sessionStorage.setItem('medsked-admin-app-session', 'active');
  } catch (error) {
    // no-op
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await loginAdmin(email.trim(), password);

      if (!result?.user || result.user.role !== 'admin') {
        throw new Error('This account is not authorized for the admin area.');
      }

      localStorage.setItem(
        'medsked-admin-auth',
        JSON.stringify({ token: result.token, user: result.user })
      );
      markActiveSession();

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand">
            <img className="auth-logo" src={medskedLogo} alt="MedSked" />
            <div className="auth-brand-copy">
              <strong>MedSked</strong>
              <span>Administration portal</span>
            </div>
          </div>
          <h1>Admin Sign In</h1>
          <p>Sign in with your administrator account.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="Enter admin email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError('');
              }}
              disabled={loading}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              disabled={loading}
              required
            />
          </label>

          {error ? <div className="error-banner" role="alert" aria-live="polite">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
