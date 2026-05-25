import { useEffect, useState } from 'react';
import type { AuditLogEntry } from '@nacionfit/shared';
import { getAdminAudit } from '../../lib/api';

export function AdminAudit() {
  const [rows, setRows] = useState<AuditLogEntry[] | null>(null);

  useEffect(() => {
    getAdminAudit().then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows) return <p className="font-body text-ink/60">Cargando…</p>;

  return (
    <div>
      <h1 className="mb-5 font-display text-3xl leading-tight text-green">
        Registro de <span className="italic text-terra">auditoría</span>
      </h1>

      {rows.length === 0 ? (
        <p className="font-body text-ink/60">Sin acciones registradas todavía.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/60">
                <th className="px-4 py-3 font-medium">Cuándo</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Objetivo</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3 text-ink/60">
                    {new Date(r.createdAt).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-ink/70">#{r.adminUserId}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.action === 'delete'
                          ? 'bg-terra-pale text-terra'
                          : 'bg-green-pale text-green'
                      }`}
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {r.targetType} {r.targetId != null ? `#${r.targetId}` : ''}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <code className="block truncate font-mono text-xs text-ink/50">
                      {r.payload ? JSON.stringify(r.payload) : '—'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
