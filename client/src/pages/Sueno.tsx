import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HealthData } from '@mi-cocina/shared';
import { getHealthMe } from '../lib/api';
import { fmtSleep } from '../lib/health';
import { Card } from '../components/Card';
import { BarChart, StageBar, Trend } from '../components/charts';

function weekday(date: string): string {
  const s = new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'short',
  });
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace('.', '');
}

export function Sueno() {
  const [days, setDays] = useState<HealthData[] | null>(null);

  useEffect(() => {
    let active = true;
    getHealthMe()
      .then((d) => active && setDays(d))
      .catch(() => active && setDays([]));
    return () => {
      active = false;
    };
  }, []);

  if (days === null) {
    return <p className="font-body text-ink/60">Cargando…</p>;
  }

  const hasSleep = days.some((d) => d.sleepMinutes != null);

  if (days.length === 0 || !hasSleep) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl leading-tight text-green">
          Sueño &amp; <span className="italic text-terra">Recuperación</span>
        </h1>
        <Card pre="Sin" em="datos">
          <p className="font-body text-ink/70">
            Todavía no recibimos datos de sueño.{' '}
            <Link to="/app/settings" className="text-terra underline-offset-2 hover:underline">
              Conectá tu Apple Watch en Ajustes
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const lastNight = [...days].reverse().find((d) => d.sleepMinutes != null)!;
  const deep = lastNight.deepSleepMinutes ?? 0;
  const rem = lastNight.remSleepMinutes ?? 0;
  const awake = lastNight.awakeMinutes ?? 0;
  const light = Math.max(0, (lastNight.sleepMinutes ?? 0) - deep - rem);

  const latestHrv = [...days].reverse().find((d) => d.hrvMs != null)?.hrvMs ?? null;
  const latestRhr = [...days].reverse().find((d) => d.restingHr != null)?.restingHr ?? null;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl leading-tight text-green">
        Sueño &amp; <span className="italic text-terra">Recuperación</span>
      </h1>

      <Card pre="Anoche" em={fmtSleep(lastNight.sleepMinutes)}>
        <StageBar
          format={fmtSleep}
          segments={[
            { label: 'Profundo', minutes: deep, color: 'var(--green)' },
            { label: 'REM', minutes: rem, color: 'var(--terra)' },
            { label: 'Ligero', minutes: light, color: 'var(--green-pale)' },
            { label: 'Despierto', minutes: awake, color: 'var(--sun)' },
          ]}
        />
      </Card>

      <Card pre="Sueño · últimos" em="7 días">
        <BarChart
          color="var(--green)"
          data={days.map((d) => ({
            label: weekday(d.date),
            value: d.sleepMinutes ?? 0,
            caption: d.sleepMinutes ? (d.sleepMinutes / 60).toFixed(1) : '',
          }))}
        />
      </Card>

      <Card pre="Variabilidad cardíaca" em="(HRV)">
        <div className="mb-2 font-body text-sm text-ink/60">
          Último:{' '}
          <span className="font-medium text-ink">
            {latestHrv != null ? `${latestHrv} ms` : '—'}
          </span>
        </div>
        <Trend color="var(--terra)" values={days.map((d) => d.hrvMs)} />
      </Card>

      <Card pre="Frecuencia en" em="reposo">
        <div className="mb-2 font-body text-sm text-ink/60">
          Último:{' '}
          <span className="font-medium text-ink">
            {latestRhr != null ? `${latestRhr} lpm` : '—'}
          </span>
        </div>
        <Trend color="var(--green)" values={days.map((d) => d.restingHr)} />
      </Card>
    </div>
  );
}
