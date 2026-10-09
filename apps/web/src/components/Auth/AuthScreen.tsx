
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { authClient } from '../../lib/auth-client';
import './AuthScreen.css';

export function AuthScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const isSignUp = location.pathname === '/signup';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isPending) {
    return <div className="auth-loading">Loading your ocean...</div>;
  }

  if (session) {
    return <Navigate to="/aquariums" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
          name,
          email,
          password,
        })
        : await authClient.signIn.email({
          email,
          password,
        });

      if (result.error) {
        setError(result.error.message ?? 'Authentication failed');
        return;
      }

      navigate('/aquariums', { replace: true });
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-bubbles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} className={`auth-bubble bubble-${index + 1}`} />
        ))}
      </div>

      <div className="auth-decoration auth-fish-left" aria-hidden="true">
        🐠
      </div>
      <div className="auth-decoration auth-fish-right" aria-hidden="true">
        🐟
      </div>

      <div className="auth-container">
        <header className="auth-brand">
          <div className="auth-logo">🐠</div>
          <h1>Family Aquarium</h1>
          <p>A little ocean full of imagination</p>
        </header>

        <section className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-greeting">
              {isSignUp ? '✨ Start your adventure' : '👋 Welcome back'}
            </span>

            <h2>
              {isSignUp ? 'Create your ocean' : 'Dive back in!'}
            </h2>

            <p>
              {isSignUp
                ? 'Create an account and bring your fish to life.'
                : 'Your underwater friends are waiting for you.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="auth-field">
                <label htmlFor="auth-name">Your name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>

              <div className="auth-password-wrapper">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete={
                    isSignUp ? 'new-password' : 'current-password'
                  }
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isSignUp
                  ? 'Create My Aquarium →'
                  : 'Dive In →'}
            </button>
          </form>

          <div className="auth-divider">
            <span>🐚</span>
          </div>

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to our ocean?'}{' '}
            <Link
              to={isSignUp ? '/login' : '/signup'}
              onClick={() => setError('')}
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </section>

        <footer className="auth-footer">
          Made for little artists and big imaginations ✨
        </footer>
      </div>

      <div className="auth-seabed" aria-hidden="true">
        <span>🪸</span>
        <span>🌿</span>
        <span>🪸</span>
        <span>🌱</span>
      </div>
    </main>
  );
}
