import type { ReactNode } from 'react';

interface CardProps {
  /** Plain (green) leading part of the title. */
  pre?: string;
  /** Emphasized part, rendered in italic terra. */
  em: string;
  children: ReactNode;
}

export function Card({ pre, em, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 font-display text-xl leading-snug text-green">
        {pre ? `${pre} ` : ''}
        <span className="italic text-terra">{em}</span>
      </h2>
      {children}
    </section>
  );
}
