import React, { ReactNode } from 'react';

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{children}</div>;
}

export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-base leading-7 text-muted-foreground">{children}</p>;
}

export function AcaiciaPageShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children?: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              {eyebrow}
            </div>
            <h1 className="mt-6 font-serif text-5xl font-medium leading-[0.98] tracking-[-0.045em] sm:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-primary-foreground/75">
              {description}
            </p>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
