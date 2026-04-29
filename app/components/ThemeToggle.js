"use client";

import { useEffect, useState } from "react";

// Два режима: 'light' | 'dark'.
// При первом заходе тема берётся из системы (см. скрипт-bootstrap в layout.js),
// после первого клика — фиксируется в localStorage.
const STORAGE_KEY = "theme";

function readActiveTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.toggle("dark", theme === "dark");
  html.classList.toggle("light", theme === "light");
}

export function ThemeToggle() {
  // На сервере и до hydration — null, рисуем плейсхолдер (антивраг hydration mismatch + FOUC).
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(readActiveTheme());
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
    applyTheme(next);
  }

  if (theme === null) {
    return <div className="w-9 h-9 rounded-full bg-surface border border-stroke" aria-hidden />;
  }

  const Icon = theme === "dark" ? MoonIcon : SunIcon;
  const title = theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему";

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className="w-9 h-9 rounded-full bg-surface border border-stroke
                 hover:bg-surface-strong hover:border-stroke-strong
                 transition flex items-center justify-center text-fg-muted hover:text-fg"
    >
      <Icon />
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
