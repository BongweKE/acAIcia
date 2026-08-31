import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <Link to="/" className="flex items-center gap-3 hover:text-foreground transition-colors">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
            <img src="/logo-new.svg" alt="" className="h-4 w-4 object-contain" />
          </span>
          <span>acAIcia · © Landscape Alliance AI Assistant</span>
        </Link>
        <span className="flex items-center gap-1.5">
          <Leaf className="h-3.5 w-3.5 text-accent" /> Evidence with context
        </span>
      </div>
    </footer>
  );
};
