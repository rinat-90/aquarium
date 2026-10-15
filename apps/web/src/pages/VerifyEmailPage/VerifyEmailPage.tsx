import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { authClient } from '../../lib/auth-client';
import '../../components/Auth/AuthScreen.css';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const email = params.get('email')?.trim() ?? '';
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function resend() {
    if (!email || sending) return;
    setSending(true);
    setMessage('');
    setError('');
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/aquariums`,
      });
      if (result.error) throw new Error(result.error.message ?? 'Unable to send email');
      setMessage('If the account exists and is unverified, a new email will arrive shortly.');
    } catch {
      setError('Unable to send verification email. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-brand">
          <div className="auth-logo" aria-hidden="true">
            🐠
          </div>
          <h1>Family Aquarium</h1>
          <p>A little ocean full of imagination</p>
        </header>
        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-greeting">✉️ One more step</span>
            <h2>Check your email</h2>
            <p>
              We've sent a verification link to your inbox. Open it to start exploring your ocean.
            </p>
          </div>
          {email && (
            <p
              style={{
                overflowWrap: 'anywhere',
                textAlign: 'center',
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              {email}
            </p>
          )}
          <p style={{ textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
            Didn't receive it? Check your spam folder, or request another link.
          </p>
          {message && (
            <div className="auth-success" role="status" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}
          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button
            className="auth-submit"
            type="button"
            disabled={!email || sending}
            onClick={() => void resend()}
          >
            {sending ? 'Sending...' : 'Resend verification email'}
          </button>
          <p className="auth-switch">
            <Link to="/login">Back to sign in</Link>
          </p>
          <p className="auth-switch">
            <Link to="/aquariums">I've verified my email →</Link>
          </p>
        </section>
        <footer className="auth-footer">Made for little artists and big imaginations ✨</footer>
      </div>
    </main>
  );
}
