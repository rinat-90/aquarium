import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { authClient } from '../lib/auth-client.ts';
import './AppLayout.css';

type DashboardUser = { name: string };


type NavIconName = 'waves' | 'fish' | 'radio-tower' | 'user-round';

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, ReactNode> = {
    waves: <><path d="M2 6c.6 0 1.1.3 1.5.7a4.2 4.2 0 0 0 6 0 2 2 0 0 1 3 0 4.2 4.2 0 0 0 6 0c.4-.4.9-.7 1.5-.7" /><path d="M2 12c.6 0 1.1.3 1.5.7a4.2 4.2 0 0 0 6 0 2 2 0 0 1 3 0 4.2 4.2 0 0 0 6 0c.4-.4.9-.7 1.5-.7" /><path d="M2 18c.6 0 1.1.3 1.5.7a4.2 4.2 0 0 0 6 0 2 2 0 0 1 3 0 4.2 4.2 0 0 0 6 0c.4-.4.9-.7 1.5-.7" /></>,
    fish: <><path d="M6.5 12c2.4-4 5.8-6 9.5-6 2.5 0 4.5 2.7 5 6-.5 3.3-2.5 6-5 6-3.7 0-7.1-2-9.5-6Z" /><path d="M6.5 12 2 7v10l4.5-5Z" /><path d="M13 9.5h.01" strokeWidth="3" strokeLinecap="round" /></>,
    'radio-tower': <><path d="M4.9 19.1a10 10 0 0 1 0-14.2" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4" /><path d="M19.1 4.9a10 10 0 0 1 0 14.2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4" /><circle cx="12" cy="12" r="2" /><path d="m12 14 0 8" /><path d="m9 22 3-8 3 8" /></>,
    'user-round': <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  };

  return (
    <svg className="aquariums-mobile-nav__svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  // Create Fish retains its standalone heading on desktop only.
  const isCreateFish = pathname === '/fish/create';
  const showHeader = !isCreateFish;
  const mobileSubtitle = pathname === '/fish/create' ? 'Create a Fish' : pathname === '/tv/manage' ? 'TV Broadcast' : pathname === '/profile' ? 'Profile' : 'Aquariums';
  const [user, setUser] = useState<DashboardUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const result: unknown = await authClient.getSession({ query: {} });
        if (typeof result !== 'object' || result === null || !('data' in result)) return;
        const data = result.data;
        if (typeof data !== 'object' || data === null || !('user' in data)) return;
        const sessionUser = data.user;
        if (typeof sessionUser !== 'object' || sessionUser === null || !('name' in sessionUser)) return;
        if (!cancelled && typeof sessionUser.name === 'string') {
          setUser({ name: sessionUser.name });
        }
      } catch {
        // The protected route handles authentication; keep the fallback label here.
      }
    }
    void loadUser();
    return () => { cancelled = true; };
  }, []);

  const displayName = user?.name?.trim() || 'Aquarium User';

  return (
    <div className={`aquariums-layout${showHeader ? " aquariums-layout--with-header" : ""}${isCreateFish ? " aquariums-layout--create-fish" : ""}`}>
      <header className="aquariums-topbar">
        <Link className="aquariums-topbar__brand" to="/aquariums" aria-label="Family Aquarium home">
          <span className="aquariums-topbar__brand-icon" aria-hidden="true">🐠</span>
          <span className="aquariums-topbar__brand-name"><strong>Family</strong><small className="aquariums-topbar__subtitle-desktop">Aquarium</small><small className="aquariums-topbar__subtitle-mobile">{mobileSubtitle}</small></span>
        </Link>
        <Link className="aquariums-account" to="/profile" aria-label={`Profile: ${displayName}`}>
          <span className="aquariums-account__avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
        </Link>
      </header>
      <main className="aquariums-content"><Outlet /></main>
      <nav className="aquariums-mobile-nav" aria-label="Main navigation">
        <NavLink to="/aquariums" end className={({ isActive }) => `aquariums-mobile-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="aquariums-mobile-nav__icon"><NavIcon name="waves" /></span><span>Aquariums</span>
        </NavLink>
        <NavLink to="/fish/create" className={({ isActive }) => `aquariums-mobile-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="aquariums-mobile-nav__icon"><NavIcon name="fish" /></span><span>Create Fish</span>
        </NavLink>
        <NavLink to="/tv/manage" className={({ isActive }) => `aquariums-mobile-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="aquariums-mobile-nav__icon"><NavIcon name="radio-tower" /></span><span>TV</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `aquariums-mobile-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="aquariums-mobile-nav__icon"><NavIcon name="user-round" /></span><span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
