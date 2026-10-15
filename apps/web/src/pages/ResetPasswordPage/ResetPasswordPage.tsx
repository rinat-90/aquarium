import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { authClient } from '../../lib/auth-client';
import '../../components/Auth/AuthScreen.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const linkError = params.get('error');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !token) return;
    setError('');

    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError('This reset link may be invalid or expired. Request a new link and try again.');
        return;
      }
      setCompleted(true);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Unable to reset your password right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-brand">
          <div className="auth-logo">🐠</div>
          <h1>Family Aquarium</h1>
          <p>A little ocean full of imagination</p>
        </header>

        <section className="auth-card">
          <div className="auth-card-heading">
            <h2>{completed ? 'Password updated!' : 'Create a new password'}</h2>
            <p>
              {completed
                ? 'Your password has been reset. You can now sign in.'
                : 'Choose a new password for your Family Aquarium account.'}
            </p>
          </div>

          {completed ? (
            <p className="auth-switch" role="status">
              <Link to="/login">Go to login</Link>
            </p>
          ) : !token || linkError ? (
            <div role="alert" className="auth-error">
              This password reset link is invalid or has expired.{' '}
              <Link to="/forgot-password">Request a new link</Link>.
            </div>
          ) : (
            <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="auth-field">
                <label htmlFor="new-password">New password</label>
                <div className="auth-password-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading}
                />
              </div>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? 'Updating password...' : 'Reset Password'}
              </button>
            </form>
          )}
          <p className="auth-switch"><Link to="/login">Back to login</Link></p>
        </section>
      </div>
    </main>
  );
}
