
import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router';

import { authClient } from '../lib/auth-client.ts';

import './AppLayout.css';

type DashboardUser = {
  name: string;
};

export function AppLayout() {
  const navigate = useNavigate();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const result: unknown = await authClient.getSession({
          query: {},
        });

        if (
          typeof result !== 'object' ||
          result === null ||
          !('data' in result)
        ) return;

        const data = result.data;

        if (
          typeof data !== 'object' ||
          data === null ||
          !('user' in data)
        ) return;

        const sessionUser = data.user;

        if (
          typeof sessionUser !== 'object' ||
          sessionUser === null ||
          !('name' in sessionUser)
        ) return;

        if (!cancelled && typeof sessionUser.name === 'string') {
          setUser({ name: sessionUser.name });
        }
      } catch {
        // Keep the fallback user label.
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSignOutError(null);

    try {
      const result = await authClient.signOut({});

      if (result.error) {
        setSignOutError(
          result.error.message ?? 'Failed to sign out',
        );
        return;
      }

      navigate('/login', { replace: true });
    } catch {
      setSignOutError('Failed to sign out');
    }
  }

  return (
    <div className="aquariums-layout">
      <aside className="aquariums-sidebar">
        <Link className="aquariums-brand" to="/aquariums">
          <span className="aquariums-brand__icon">🐠</span>

          <span>
            <strong>Family</strong>
            <small>Aquarium</small>
          </span>
        </Link>

        <nav
          className="aquariums-navigation"
          aria-label="Main navigation"
        >
          <NavLink
            to="/aquariums"
            end
            className={({ isActive }) =>
              `aquariums-navigation__item${isActive ? ' active' : ''}`
            }
          >
            <span>▣</span>
            Aquariums
          </NavLink>

          <NavLink
            to="/fish/create"
            className={({ isActive }) =>
              `aquariums-navigation__item${isActive ? ' active' : ''}`
            }
          >
            <span>✧</span>
            Create Fish
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `aquariums-navigation__item${isActive ? ' active' : ''}`
            }
          >
            <span>♙</span>
            Profile
          </NavLink>
        </nav>

        <div className="aquariums-sidebar__bottom">
          <div className="aquariums-user">
            <div className="aquariums-user__avatar">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>

            <div className="aquariums-user__details">
              <strong>
                {user?.name ?? 'Aquarium User'}
              </strong>

              <button
                type="button"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            </div>
          </div>

          {signOutError && (
            <p role="alert" className="aquariums-error">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      <main className="aquariums-content">
        <Outlet />
      </main>
    </div>
  );
}
