import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Wordmark } from './Wordmark';
import { ThemeToggle } from './ThemeToggle';

export const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b border-border bg-card sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Wordmark />

        {/* Primary Desktop Navigation */}
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Primary navigation">
          <Link
            to="/assistant"
            aria-current={isActive('/assistant') ? 'page' : undefined}
            className={`transition-colors hover:text-foreground ${
              isActive('/assistant') ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
          >
            Ask acAIcia
          </Link>
          <Link
            to="/how-it-works"
            aria-current={isActive('/how-it-works') ? 'page' : undefined}
            className={`transition-colors hover:text-foreground ${
              isActive('/how-it-works') ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
          >
            How it works
          </Link>
          <Link
            to="/about"
            aria-current={isActive('/about') ? 'page' : undefined}
            className={`transition-colors hover:text-foreground ${
              isActive('/about') ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }`}
          >
            About
          </Link>
        </nav>

        {/* Header Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link
            to="/feedback"
            className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Citation feedback
          </Link>
          <Link
            to="/assistant"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90"
          >
            Ask a question <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {menuOpen && (
        <nav
          className="mx-6 mb-4 grid gap-1 rounded-xl border border-border bg-background p-3 text-sm md:hidden animate-in fade-in slide-in-from-top-2"
          aria-label="Mobile navigation"
        >
          <Link
            to="/assistant"
            className={`rounded-md px-3 py-2 transition-colors ${
              isActive('/assistant') ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            Ask acAIcia
          </Link>
          <Link
            to="/how-it-works"
            className={`rounded-md px-3 py-2 transition-colors ${
              isActive('/how-it-works') ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            How it works
          </Link>
          <Link
            to="/about"
            className={`rounded-md px-3 py-2 transition-colors ${
              isActive('/about') ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          <Link
            to="/feedback"
            className={`rounded-md px-3 py-2 transition-colors ${
              isActive('/feedback') ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            Citation feedback
          </Link>
          <div className="pt-2 border-t border-border flex items-center justify-between px-3">
            <span className="text-xs text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </nav>
      )}
    </header>
  );
};
