"use client";

import { useEffect, useState } from "react";

// Три режима: 'light' | 'dark' | 'system'.
// 'system' хранится как отсутствие записи в localStorage.
const STORAGE_KEY = "theme";

function readChoice() {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function resolveActive(choice) {
  if (choice === "light" || choice === "dark") return choice;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(choice) {
  const active = resolveActive(choice);
  const html = document.documentElement;
  html.classList.toggle("dark", active === "dark");
  html.classList.toggle("light", active === "light");
}

export function ThemeToggle() {
  // На сервере и до hydration не знаем выбор пользователя — рисуем плейсхолдер
  // чтобы избежать hydration mismatch и FOUC иконки.
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    setChoice(readChoice());

    // Если выбрано «system», слушаем изменения системы и подстраиваемся
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readChoice() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const order = ["light", "dark", "system"];
    const next = order[(order.indexOf(choice) + 1) % order.length];
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
    setChoice(next);
    applyTheme(next);
  }

  // Плейсхолдер размером с финальную кнопку
  if (choice === null) {
    return <div className="w-9 h-9 rounded-full bg-surface border border-stroke" aria-hidden />;
  }

  const labels = {
    light: { icon: SunIcon, title: "Светлая тема (нажмите чтобы сменить)" },
    dark: { icon: MoonIcon, title: "Тёмная тема (нажмите чтобы сменить)" },
    system: { icon: SystemIcon, title: "Системная тема (нажмите чтобы сменить)" },
  };
  const Icon = labels[choice].icon;

  return (
    <button
      type="button"
      onClick={cycle}
      title={labels[choice].title}
      aria-label={labels[choice].title}
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

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
