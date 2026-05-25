import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminUserSummary } from '@nacionfit/shared';
import { getAdminUsers } from '../../lib/api';

type SortKey = 'createdAt' | 'lastActiveAt';

export function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const sorted = useMemo(() => {
    if (!users) return [];
    const copy = [...users];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return desc ? -cmp : cmp;
    });
    return copy;
  }, [users, sortKey, desc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  if (!users) return <p className="font-body text-ink/60">Cargando…</p>;

  const arrow = (key: SortKey) => (key === sortKey ? (desc ? ' ↓' : ' ↑') : '');

  return (
    <div>
      <h1 className="mb-5 font-display text-3xl leading-tight text-green">
        Todos los <span className="italic text-terra">usuarios</span>{' '}
        <span className="font-body text-base text-ink/40">({users.length})</span>
      </h1>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink/60">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-green"
                onClick={() => toggleSort('createdAt')}
              >
                Alta{arrow('createdAt')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-green"
                onClick={() => toggleSort('lastActiveAt')}
              >
                Última actividad{arrow('lastActiveAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                className="cursor-pointer border-b border-line/60 transition last:border-0 hover:bg-bg"
              >
                <td className="px-4 py-3 text-ink">{u.email}</td>
                <td className="px-4 py-3 text-ink/80">{u.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.role === 'admin'
                        ? 'bg-terra-pale text-terra'
                        : 'bg-green-pale text-green'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/60">{u.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-ink/60">{u.lastActiveAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
