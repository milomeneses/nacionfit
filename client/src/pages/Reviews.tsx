import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { WeeklyReview, WeeklyReviewSummary } from '@nacionfit/shared';
import {
  generateReview as apiGenerateReview,
  getReview,
  getReviews,
  markReviewRead,
} from '../lib/api';
import { enablePush } from '../lib/push';
import { Card } from '../components/Card';

function fmtRange(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T12:00:00`);
  const e = new Date(`${weekEnd}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString('es-AR', { month: 'long' });
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} al ${e.getDate()} de ${month(e)}`;
  }
  const short = (d: Date) =>
    `${d.getDate()} ${d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}`;
  return `${short(s)} al ${short(e)}`;
}

export function Reviews() {
  const { weekStart: param } = useParams<{ weekStart?: string }>();
  const [list, setList] = useState<WeeklyReviewSummary[]>([]);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const summaries = await getReviews();
      if (!active) return;
      setList(summaries);
      const target = param ?? summaries[0]?.weekStart ?? null;
      if (!target) {
        setReview(null);
        setLoading(false);
        return;
      }
      const r = await getReview(target);
      if (!active) return;
      setReview(r);
      if (!r.readAt) {
        markReviewRead(target);
        setList((prev) =>
          prev.map((x) =>
            x.weekStart === target ? { ...x, readAt: new Date().toISOString() } : x,
          ),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [param]);

  async function onGenerate() {
    setGenerating(true);
    setNotice(null);
    try {
      const r = await apiGenerateReview();
      setReview(r);
      setList(await getReviews());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo generar el review.');
    } finally {
      setGenerating(false);
    }
  }

  async function onEnablePush() {
    const result = await enablePush();
    setNotice(
      result === 'ok'
        ? 'Avisos activados.'
        : result === 'denied'
          ? 'Permiso de notificaciones denegado.'
          : result === 'unsupported'
            ? 'Tu navegador no soporta notificaciones push.'
            : 'No se pudieron activar los avisos.',
    );
  }

  const title = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-3xl leading-tight text-green">
        Review <span className="italic text-terra">semanal</span>
      </h1>
      <button
        type="button"
        onClick={onEnablePush}
        className="rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-ink transition hover:bg-bg"
      >
        Activar avisos
      </button>
    </div>
  );

  if (loading) return <p className="font-body text-ink/60">Cargando…</p>;

  if (!review) {
    return (
      <div className="space-y-5">
        {title}
        <Card pre="Todavía" em="sin review">
          <p className="font-display text-xl italic leading-relaxed text-green">
            Cuando cierre tu primera semana completa vas a ver acá tu review.
          </p>
          {notice && <p className="mt-3 font-body text-sm text-terra">{notice}</p>}
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="mt-4 rounded-lg bg-green px-4 py-2.5 font-body font-medium text-surface transition hover:bg-green/90 disabled:opacity-60"
          >
            {generating ? 'Generando…' : 'Generar mi review'}
          </button>
        </Card>
      </div>
    );
  }

  const habitAvg =
    review.data.habitCompletion && review.data.habitCompletion.length > 0
      ? Math.round(
          (review.data.habitCompletion.reduce((a, h) => a + h.rate, 0) /
            review.data.habitCompletion.length) *
            100,
        )
      : null;

  const others = list.filter((r) => r.weekStart !== review.weekStart);

  return (
    <div className="space-y-5">
      {title}
      {notice && <p className="font-body text-sm text-ink/70">{notice}</p>}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="font-body text-xs uppercase tracking-wide text-terra">
          Tu semana · {fmtRange(review.weekStart, review.weekEnd)}
        </p>
        <p className="mt-3 font-display text-2xl italic leading-relaxed text-green">
          {review.narrative}
        </p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Peso"
          value={
            review.data.kgChange != null
              ? `${review.data.kgChange > 0 ? '+' : ''}${review.data.kgChange} kg`
              : '—'
          }
        />
        <Stat label="Hábitos" value={habitAvg != null ? `${habitAvg}%` : '—'} />
        <Stat
          label="Varianza"
          value={review.data.variance != null ? review.data.variance.toFixed(2) : '—'}
        />
      </div>

      <div className="space-y-3">
        {review.insights.map((ins, i) => (
          <section key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex gap-3">
              <span className="w-7 shrink-0 font-display text-2xl italic leading-none text-terra">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-lg text-green">{ins.title}</h3>
                <p className="mt-1 font-body text-ink/80">{ins.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-green/30 bg-green-pale p-6">
        <p className="font-body text-xs uppercase tracking-wide text-green">
          Experimento de la semana
        </p>
        <h3 className="mt-1 font-display text-xl italic text-green">{review.experiment.title}</h3>
        <p className="mt-2 font-body text-ink/80">{review.experiment.body}</p>
        <p className="mt-3 font-body text-sm text-ink">
          <span className="font-medium">Lo lográs si:</span>{' '}
          {review.experiment.success_criteria}
        </p>
      </section>

      {others.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface/50 p-5">
          <h3 className="mb-2 font-display text-lg text-green">Reviews anteriores</h3>
          <ul className="space-y-1">
            {others.map((r) => (
              <li key={r.weekStart}>
                <Link
                  to={`/app/reviews/${r.weekStart}`}
                  className="block rounded-lg px-2 py-2 font-body text-sm text-ink/70 transition hover:bg-bg hover:text-green"
                >
                  {fmtRange(r.weekStart, r.weekEnd)}
                  {!r.readAt && <span className="ml-2 text-terra">• nuevo</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center">
      <p className="font-display text-2xl text-green">{value}</p>
      <p className="mt-1 font-body text-xs uppercase tracking-wide text-ink/50">{label}</p>
    </div>
  );
}
