import { useEffect, useState } from 'react';
import type { WebhookTokenInfo } from '@mi-cocina/shared';
import { getHealthToken, regenerateHealthToken } from '../lib/api';
import { fmtDateTimeEs, webhookUrl } from '../lib/health';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

const STEPS = [
  'Instalá “Health Auto Export — JSON+CSV” desde la App Store (las automatizaciones requieren la versión paga).',
  'En la app, abrí “Automations” y creá una automatización nueva.',
  'Elegí “REST API” como destino y pegá la URL del webhook de arriba.',
  'Método POST, formato JSON.',
  'Agregá las métricas: Sleep Analysis, Heart Rate Variability, Resting Heart Rate, Step Count y Active Energy.',
  'Definí la frecuencia (por ejemplo, automático cada mañana) y guardá.',
];

export function Ajustes() {
  const [info, setInfo] = useState<WebhookTokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    getHealthToken()
      .then((i) => active && setInfo(i))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const url = info ? webhookUrl(info.token) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function regenerate() {
    if (
      !window.confirm(
        '¿Generar una URL nueva? La URL anterior dejará de funcionar y tendrás que actualizarla en Health Auto Export.',
      )
    )
      return;
    setRegenerating(true);
    try {
      setInfo(await regenerateHealthToken());
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return <p className="font-body text-ink/60">Cargando…</p>;
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl leading-tight text-green">
        <span className="italic text-terra">Ajustes</span>
      </h1>

      <Card pre="Conectá tu" em="Apple Watch">
        <p className="mb-3 font-body text-sm text-ink/70">
          Usá esta URL como destino del webhook en Health Auto Export. Es secreta:
          cualquiera con ella puede enviar datos a tu cuenta.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg border border-green bg-green px-4 py-2 font-body text-sm text-surface transition hover:bg-green/90"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="mt-3 font-body text-sm text-ink/60">
          Última sincronización:{' '}
          <span className="text-ink">{fmtDateTimeEs(info?.lastSyncAt ?? null)}</span>
        </p>
      </Card>

      <Card pre="Cómo" em="configurarlo">
        <ol className="list-decimal space-y-2 pl-5 font-body text-sm text-ink/80 marker:text-terra">
          {STEPS.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Card>

      <Card pre="Regenerar" em="URL">
        <p className="mb-4 font-body text-sm text-ink/70">
          Si creés que tu URL quedó expuesta, generá una nueva. Vas a tener que
          actualizarla en Health Auto Export.
        </p>
        <div className="max-w-xs">
          <Button type="button" onClick={regenerate} disabled={regenerating}>
            {regenerating ? 'Generando…' : 'Generar URL nueva'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
