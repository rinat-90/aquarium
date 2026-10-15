import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authClient } from '../../lib/auth-client';
import '../../components/Auth/AuthScreen.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Unable to send reset email');
      }

      setSent(true);
    } catch {
      setError('Unable to send the reset email. Please try again.');
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
            <h2>Forgot your password?</h2>
            <p>Enter your email address and we'll send you a link to reset your password.</p>
          </div>

          {sent ? (
            <div className="auth-success" role="status">
              If an account exists for that email address, you'll receive a password reset link
              shortly. Please check your inbox.
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="auth-switch">
            <Link to="/login">Back to login</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
