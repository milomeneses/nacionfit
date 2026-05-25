interface IntensityDotsProps {
  value: number | null;
  max?: number;
  size?: 'sm' | 'md';
  onChange?: (value: number) => void;
}

export function IntensityDots({ value, max = 10, size = 'md', onChange }: IntensityDotsProps) {
  const dim = size === 'sm' ? 'h-2.5 w-2.5' : 'h-6 w-6';
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const on = value != null && value >= n;
        const base = `${dim} rounded-full transition ${on ? 'bg-terra' : 'bg-terra/15'}`;
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`Intensidad ${n}`}
            aria-pressed={on}
            onClick={() => onChange(n)}
            className={`${base} cursor-pointer hover:bg-terra/60`}
          />
        ) : (
          <span key={n} className={base} />
        );
      })}
    </div>
  );
}
