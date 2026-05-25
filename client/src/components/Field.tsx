import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, ...props }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="block font-body text-sm font-medium text-ink mb-1.5">
        {label}
      </span>
      <input
        id={id}
        className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 font-body text-ink placeholder:text-ink/35 outline-none transition focus:border-green focus:ring-2 focus:ring-green-pale"
        {...props}
      />
    </label>
  );
}
