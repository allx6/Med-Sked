import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { loginAdmin } from '../services/api';

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
          <div className="brand-mark large">M</div>
          <h1>MedSked Admin</h1>
          <p>Secure sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
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
