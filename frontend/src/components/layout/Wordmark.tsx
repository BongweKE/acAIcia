import React from 'react';
import { Link } from 'react-router-dom';

export const Wordmark: React.FC = () => {
  return (
    <Link to="/" className="flex items-center gap-3 group" aria-label="acAIcia home">
      <span className="relative grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground shadow-sm transition-transform group-hover:scale-105">
        <img
          src="/logo-new.svg"
          alt="acAIcia Tree Logo"
          className="h-6 w-6 object-contain"
        />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-chart-4 shadow-sm" />
      </span>
      <span className="leading-none">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          ACAICIA
        </span>
        <span className="mt-1 block text-sm font-semibold tracking-tight text-foreground">
          Landscape Alliance Intelligence
        </span>
      </span>
    </Link>
  );
};
