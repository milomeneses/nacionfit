import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface TabDef {
  label: string;
  to?: string;
  end?: boolean;
}

const TABS: TabDef[] = [
  { label: 'Hoy', to: '/app', end: true },
  { label: 'Antojos', to: '/app/antojos' },
  { label: 'Patrones', to: '/app/patrones' },
  { label: 'Coach', to: '/app/coach' },
  { label: 'Sueño', to: '/app/sueno' },
  { label: 'Tools', to: '/app/tools' },
  { label: 'Plan' },
];

const tabBase = '-mb-px border-b-2 px-4 py-2 font-body text-sm transition whitespace-nowrap';

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
          <NavLink to="/app" end className="font-display text-xl text-green">
            Nacion<span className="italic text-terra">Fit</span>
          </NavLink>
          <div className="flex items-center gap-3 font-body text-sm">
            <span className="hidden text-ink/60 sm:inline">{user?.email}</span>
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                `rounded-md border px-3 py-1.5 transition ${
                  isActive
                    ? 'border-green bg-green-pale text-green'
                    : 'border-line text-ink hover:bg-bg'
                }`
              }
            >
              Ajustes
            </NavLink>
            <button
              onClick={logout}
              className="rounded-md border border-line px-3 py-1.5 text-ink transition hover:bg-bg"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-8">
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) =>
            t.to ? (
              <NavLink
                key={t.label}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `${tabBase} ${
                    isActive
                      ? 'border-terra text-green'
                      : 'border-transparent text-ink/50 hover:text-green'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ) : (
              <button
                key={t.label}
                type="button"
                disabled
                title="Próximamente"
                className={`${tabBase} cursor-not-allowed border-transparent text-ink/30`}
              >
                {t.label}
              </button>
            ),
          )}
        </nav>

        <Outlet />
      </main>
    </div>
  );
}
