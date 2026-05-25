import { useAuth } from '../lib/auth';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-full bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-display text-2xl text-green">
            Mi <span className="italic text-terra">Cocina</span>
          </span>
          <div className="flex items-center gap-4 font-body text-sm">
            <span className="text-ink/70">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-line px-3 py-1.5 text-ink transition hover:bg-surface"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="font-display text-3xl text-green">
          Your <span className="italic text-terra">kitchen</span> is ready
        </h1>
        <p className="mt-3 max-w-prose font-body text-ink/70">
          Signed in as <span className="font-medium text-ink">{user?.email}</span>.
          This is your dashboard — there’s nothing here yet.
        </p>
      </main>
    </div>
  );
}
