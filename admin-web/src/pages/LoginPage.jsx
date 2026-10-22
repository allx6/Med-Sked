import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import medskedLogo from '../assets/medsked.png';
import {
  loginAdmin,
  resendAdminMfaCode,
  verifyAdminMfa,
} from '../services/api';

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
  const [challengeToken, setChallengeToken] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');

  const completeSignIn = (result) => {
    if (!result?.user || result.user.role !== 'admin' || !result.token) {
      throw new Error('This account is not authorized for the admin area.');
    }

    localStorage.setItem(
      'medsked-admin-auth',
      JSON.stringify({ token: result.token, user: result.user })
    );
    markActiveSession();
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (challengeToken) {
        const result = await verifyAdminMfa(challengeToken, code.trim());
        completeSignIn(result);
        return;
      }

      const result = await loginAdmin(email.trim(), password);

      if (result?.mfaRequired) {
        if (result.user?.role !== 'admin' || !result.challengeToken) {
          throw new Error('Unable to start administrator verification.');
        }
        setChallengeToken(result.challengeToken);
        setNotice(result.message || 'A sign-in code was sent to your verified email address.');
        return;
      }

      completeSignIn(result);
    } catch (err) {
      setError(err.message || 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await resendAdminMfaCode(challengeToken);
      setChallengeToken(result.challengeToken);
      setNotice(result.message);
    } catch (err) {
      setError(err.message || 'Unable to resend the sign-in code.');
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
          <h1>{challengeToken ? 'Administrator verification' : 'Admin Sign In'}</h1>
          <p>
            {challengeToken
              ? 'Enter the six-digit code sent to your verified administrator email.'
              : 'Sign in with your administrator account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!challengeToken ? (
            <>
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
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <div className="mfa-email-notice" role="status">
                Check your verified email for the sign-in code. It expires in 10 minutes.
              </div>
              <label>
                <span>Email verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  disabled={loading}
                  required
                />
              </label>
            </>
          )}

          {notice ? <div className="mfa-email-notice" role="status">{notice}</div> : null}
          {error ? <div className="error-banner" role="alert" aria-live="polite">{error}</div> : null}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading
              ? 'Please wait…'
              : challengeToken ? 'Verify and sign in' : 'Sign in'}
          </button>
          {challengeToken ? (
            <button className="secondary-button" type="button" onClick={handleResend} disabled={loading}>
              Resend email code
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
