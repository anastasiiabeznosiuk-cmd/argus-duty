import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@carbon/react';
import { Logout } from '@carbon/icons-react';
import { useStore } from '../store.js';
import { connectLine, disconnectLine } from '../line.js';
import { countEvents } from '../lib/events.js';
import { useNow } from './hooks.js';
import { ConnectionBadge } from './ConnectionBadge.jsx';

const NAV = [
  { to: '/picture', label: 'Обстановка' },
  { to: '/events', label: 'Журнал подій' },
  { to: '/shift', label: 'Зміна' },
];

/** Лічильники подій — на кожному екрані (В-3), щоб черговий не пропустив критичну подію, працюючи в іншому розділі. */
export function Counters({ counts }) {
  return (
    <ul className="counters" aria-label="Лічильники подій">
      <li data-testid="count-new">
        Нових <b>{counts.new}</b>
      </li>
      <li data-testid="count-critical" className={counts.critical ? 'is-hot' : ''}>
        Критичних <b>{counts.critical}</b>
      </li>
      <li data-testid="count-overdue" className={counts.overdue ? 'is-hot' : ''}>
        Прострочених <b>{counts.overdue}</b>
      </li>
    </ul>
  );
}

export function Shell() {
  const navigate = useNavigate();
  const officer = useStore((s) => s.session?.officer);
  const events = useStore((s) => s.events);
  const conn = useStore((s) => s.conn);
  const logout = useStore((s) => s.logout);
  const now = useNow();

  useEffect(() => {
    useStore.getState().loadAll();
    connectLine();
    return () => disconnectLine();
  }, []);

  const counts = countEvents(events, now);

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__logo">ARGUS</span>
          <span className="shell__title">АРМ чергового зміни</span>
        </div>
        <nav className="shell__nav" aria-label="Розділи">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `shell__link ${isActive ? 'is-active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Counters counts={counts} />
        <div className="shell__right">
          <ConnectionBadge conn={conn} />
          <span className="shell__user" data-testid="officer">
            {officer?.rank} {officer?.name}
          </span>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Logout}
            iconDescription="Вийти"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          />
        </div>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
