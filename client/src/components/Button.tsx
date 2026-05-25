import type { ButtonHTMLAttributes } from 'react';

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return (
    <button
      className={`w-full rounded-lg bg-green px-4 py-2.5 font-body font-medium text-surface transition hover:bg-green/90 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    />
  );
}
