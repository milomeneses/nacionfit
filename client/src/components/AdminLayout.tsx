import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const tabClass =
  '-mb-px border-b-2 px-4 py-2 font-body text-sm transition whitespace-nowrap';

export function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg font-body text-ink/60">
        Cargando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/app" replace />;

  return (
    <div className="min-h-full bg-bg">
      {/* Terra bar visually marks admin pages */}
      <div className="h-1.5 w-full bg-terra" />

      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-xl text-green">
              Nacion<span className="italic text-terra">Fit</span>
            </span>
            <span className="rounded-full border border-terra/40 bg-terra-pale px-2 py-0.5 font-body text-xs uppercase tracking-wide text-terra">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3 font-body text-sm">
            <NavLink to="/app" className="text-ink/60 transition hover:text-green">
              Volver a la app
            </NavLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <nav className="mb-8 flex gap-1 border-b border-line">
          {[
            { to: '/admin/users', label: 'Usuarios' },
            { to: '/admin/metrics', label: 'Métricas' },
            { to: '/admin/audit', label: 'Auditoría' },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `${tabClass} ${
                  isActive
                    ? 'border-terra text-green'
                    : 'border-transparent text-ink/50 hover:text-green'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
