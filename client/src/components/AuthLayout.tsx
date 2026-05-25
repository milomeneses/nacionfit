import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="min-h-full bg-bg px-6 py-16 flex justify-center">
      <div className="w-full max-w-[400px]">
        <header className="mb-10">
          <h1 className="font-display text-green text-4xl leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 font-body text-ink/70 text-base leading-relaxed">
              {subtitle}
            </p>
          )}
        </header>
        {children}
        {footer && (
          <p className="mt-8 text-center font-body text-sm text-ink/60">{footer}</p>
        )}
      </div>
    </main>
  );
}
