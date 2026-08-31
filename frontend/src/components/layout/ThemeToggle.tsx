import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('acaicia_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('acaicia_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('acaicia_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shadow-sm"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-chart-4" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-accent" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
};
