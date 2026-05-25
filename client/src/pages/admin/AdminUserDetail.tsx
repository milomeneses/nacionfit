import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AdminUserDetail as Detail, ProjectIntensity, UserRole } from '@nacionfit/shared';
import {
  deleteAdminCraving,
  deleteAdminDay,
  deleteAdminUser,
  getAdminUser,
  getAdminUserCravings,
  getAdminUserDays,
  getAdminUserHealth,
  patchAdminDay,
  patchAdminUser,
  type AdminCravingRow,
  type AdminDay,
  type AdminHealthRow,
} from '../../lib/api';
import { ACTION_LABELS, TRIGGER_LABELS } from '../../lib/cravings';
import { INTENSITY_OPTIONS } from '../../lib/constants';
import { Trend } from '../../components/charts';
import { IntensityDots } from '../../components/IntensityDots';

const TABS = ['Perfil', 'Días', 'Antojos', 'Salud', 'Zona de peligro'] as const;
type Tab = (typeof TABS)[number];

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [tab, setTab] = useState<Tab>('Perfil');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [days, setDays] = useState<AdminDay[]>([]);
  const [cravings, setCravings] = useState<AdminCravingRow[]>([]);
  const [health, setHealth] = useState<AdminHealthRow[]>([]);

  async function reload() {
    const [d, dy, cr, he] = await Promise.all([
      getAdminUser(userId),
      getAdminUserDays(userId),
      getAdminUserCravings(userId),
      getAdminUserHealth(userId),
    ]);
    setDetail(d);
    setDays(dy);
    setCravings(cr);
    setHealth(he);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!detail) return <p className="font-body text-ink/60">Cargando…</p>;

  return (
    <div>
      <div className="mb-1 font-body text-sm text-ink/50">Usuario #{detail.user.id}</div>
      <h1 className="mb-5 font-display text-3xl leading-tight text-green">
        {detail.user.name} <span className="italic text-terra">· {detail.user.email}</span>
      </h1>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 font-body text-sm transition ${
              tab === t ? 'border-terra text-green' : 'border-transparent text-ink/50 hover:text-green'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Perfil' && <ProfileTab detail={detail} onSaved={reload} />}
      {tab === 'Días' && <DaysTab days={days} onChange={reload} />}
      {tab === 'Antojos' && <CravingsTab cravings={cravings} onChange={reload} />}
      {tab === 'Salud' && <HealthTab health={health} />}
      {tab === 'Zona de peligro' && <DangerTab detail={detail} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-6">{children}</section>;
}

function ProfileTab({ detail, onSaved }: { detail: Detail; onSaved: () => void }) {
  const [name, setName] = useState(detail.user.name);
  const [target, setTarget] = useState(
    detail.user.targetWeightKg != null ? String(detail.user.targetWeightKg) : '',
  );
  const [targetDate, setTargetDate] = useState(detail.user.targetDate ?? '');
  const [role, setRole] = useState<UserRole>(detail.user.role);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await patchAdminUser(detail.user.id, {
        name: name.trim(),
        targetWeightKg: target.trim() === '' ? null : Number(target),
        targetDate: targetDate.trim() === '' ? null : targetDate,
        role,
      });
      setMsg('Guardado.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  const input =
    'w-full rounded-lg border border-line bg-bg px-3 py-2 font-body text-ink outline-none focus:border-green focus:ring-2 focus:ring-green-pale';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Días" value={detail.counts.dailyLogs} />
        <Stat label="Antojos" value={detail.counts.cravings} />
        <Stat label="Charlas" value={detail.counts.conversations} />
        <Stat label="Días salud" value={detail.counts.healthDays} />
      </div>

      <Card>
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1 block font-body text-sm font-medium text-ink">Nombre</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1 block font-body text-sm font-medium text-ink">Peso objetivo (kg)</span>
              <input className={input} type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block font-body text-sm font-medium text-ink">Fecha objetivo</span>
              <input className={input} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block font-body text-sm font-medium text-ink">Rol</span>
            <select className={input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green px-4 py-2 font-body font-medium text-surface transition hover:bg-green/90 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {msg && <span className="font-body text-sm text-ink/60">{msg}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center">
      <p className="font-display text-2xl text-green">{value}</p>
      <p className="mt-1 font-body text-xs uppercase tracking-wide text-ink/50">{label}</p>
    </div>
  );
}

function DaysTab({ days, onChange }: { days: AdminDay[]; onChange: () => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<AdminDay>>({});

  async function save(id: number) {
    await patchAdminDay(id, draft);
    setEditing(null);
    setDraft({});
    onChange();
  }
  async function remove(id: number) {
    if (!window.confirm('¿Borrar este día?')) return;
    await deleteAdminDay(id);
    onChange();
  }

  if (days.length === 0) return <p className="font-body text-ink/60">Sin días registrados.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse font-body text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink/60">
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Agua</th>
            <th className="px-3 py-2 font-medium">Ánimo</th>
            <th className="px-3 py-2 font-medium">Estrés</th>
            <th className="px-3 py-2 font-medium">Peso</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const isEdit = editing === d.id;
            return (
              <tr key={d.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2 text-ink">{d.date}</td>
                {isEdit ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={d.waterCount ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, waterCount: Number(e.target.value) }))}
                        className="w-16 rounded border border-line bg-bg px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        defaultValue={d.mood ?? ''}
                        onChange={(e) => setDraft((p) => ({ ...p, mood: Number(e.target.value) }))}
                        className="w-16 rounded border border-line bg-bg px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        defaultValue={d.projectIntensity ?? ''}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, projectIntensity: (e.target.value || null) as ProjectIntensity | null }))
                        }
                        className="rounded border border-line bg-bg px-2 py-1"
                      >
                        <option value="">—</option>
                        {INTENSITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={d.weightKg ?? ''}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, weightKg: e.target.value === '' ? null : Number(e.target.value) }))
                        }
                        className="w-20 rounded border border-line bg-bg px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => save(d.id)} className="mr-2 font-medium text-green">Guardar</button>
                      <button onClick={() => { setEditing(null); setDraft({}); }} className="text-ink/50">Cancelar</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-ink/70">{d.waterCount ?? '—'}</td>
                    <td className="px-3 py-2 text-ink/70">{d.mood ?? '—'}</td>
                    <td className="px-3 py-2 text-ink/70">
                      {INTENSITY_OPTIONS.find((o) => o.value === d.projectIntensity)?.label ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-ink/70">{d.weightKg != null ? `${d.weightKg} kg` : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setEditing(d.id); setDraft({}); }}
                        className="mr-3 text-green hover:underline"
                      >
                        Editar
                      </button>
                      <button onClick={() => remove(d.id)} className="text-terra hover:underline">
                        Borrar
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CravingsTab({ cravings, onChange }: { cravings: AdminCravingRow[]; onChange: () => void }) {
  async function remove(id: number) {
    if (!window.confirm('¿Borrar este antojo?')) return;
    await deleteAdminCraving(id);
    onChange();
  }
  if (cravings.length === 0) return <p className="font-body text-ink/60">Sin antojos.</p>;
  return (
    <ul className="space-y-2">
      {cravings.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-green">{c.food}</span>
              <span className="font-body text-xs text-ink/40">{c.timestamp.slice(0, 10)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <IntensityDots value={c.intensity} size="sm" />
              <span className="rounded-full bg-terra-pale px-2 py-0.5 font-body text-xs text-terra">{TRIGGER_LABELS[c.trigger]}</span>
              <span className="rounded-full bg-green-pale px-2 py-0.5 font-body text-xs text-green">{ACTION_LABELS[c.action]}</span>
            </div>
          </div>
          <button onClick={() => remove(c.id)} className="shrink-0 font-body text-sm text-terra hover:underline">
            Borrar
          </button>
        </li>
      ))}
    </ul>
  );
}

function HealthTab({ health }: { health: AdminHealthRow[] }) {
  if (health.length === 0) return <p className="font-body text-ink/60">Sin datos de salud.</p>;
  const latestSleep = [...health].reverse().find((h) => h.sleepMinutes != null)?.sleepMinutes ?? null;
  const latestHrv = [...health].reverse().find((h) => h.hrvMs != null)?.hrvMs ?? null;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="mb-2 font-body text-sm text-ink/60">
          Sueño (h) · último{' '}
          <span className="font-medium text-ink">
            {latestSleep != null ? (latestSleep / 60).toFixed(1) : '—'}
          </span>
        </p>
        <Trend color="var(--green)" values={health.map((h) => (h.sleepMinutes != null ? Math.round((h.sleepMinutes / 60) * 10) / 10 : null))} />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="mb-2 font-body text-sm text-ink/60">
          HRV (ms) · último <span className="font-medium text-ink">{latestHrv ?? '—'}</span>
        </p>
        <Trend color="var(--terra)" values={health.map((h) => h.hrvMs)} />
      </section>
    </div>
  );
}

function DangerTab({ detail }: { detail: Detail }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      await deleteAdminUser(detail.user.id, confirm);
      navigate('/admin/users');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-terra/40 bg-terra-pale p-6">
      <h3 className="font-display text-xl italic text-terra">Borrar usuario</h3>
      <p className="mt-2 font-body text-sm text-ink/70">
        Esto elimina al usuario y <strong>todos</strong> sus datos (días, antojos, salud, charlas,
        reviews). No se puede deshacer. Escribí{' '}
        <code className="rounded bg-surface px-1 text-terra">{detail.user.email}</code> para confirmar.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={detail.user.email}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-body text-ink outline-none sm:max-w-sm"
        />
        <button
          type="button"
          onClick={del}
          disabled={busy || confirm !== detail.user.email}
          className="rounded-lg bg-terra px-4 py-2 font-body font-medium text-surface transition hover:bg-terra/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Borrando…' : 'Borrar usuario'}
        </button>
      </div>
      {err && <p className="mt-2 font-body text-sm text-terra">{err}</p>}
    </section>
  );
}
