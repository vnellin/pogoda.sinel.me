"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const TABS = [
  { href: "/", label: "Диапазон" },
  { href: "/this-day", label: "Этот день в годах" },
];

// Параметры локации передаём при переключении вкладок, чтобы не выбирать заново.
const LOCATION_KEYS = ["lat", "lon", "name", "country", "admin1", "tz"];

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Берём только параметры локации (даты/месяц/годы у вкладок свои)
  const locationParams = new URLSearchParams();
  for (const key of LOCATION_KEYS) {
    const v = searchParams.get(key);
    if (v) locationParams.set(key, v);
  }
  const queryStr = locationParams.toString();
  const suffix = queryStr ? `?${queryStr}` : "";

  return (
    <nav className="mx-auto max-w-6xl px-4 pt-6 flex items-center justify-between gap-3">
      <div className="inline-flex rounded-full bg-surface border border-stroke backdrop-blur p-1 text-sm">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${suffix}`}
              className={`px-4 py-1.5 rounded-full transition ${
                active
                  ? "bg-surface-strong text-fg-strong shadow-inner"
                  : "text-fg-soft hover:text-fg-strong hover:bg-surface"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
    </nav>
  );
}
