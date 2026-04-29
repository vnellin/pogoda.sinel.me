"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDebouncedNavigate } from "./LoadingProvider";

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

// Сколько дней в месяце (для високосных февралей всё равно поддержим 29)
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MIN_YEAR = 1979;

/**
 * Выбор «месяц + день» и диапазона годов для режима «один день в разные годы».
 * Параметры пишутся в URL (month, day, from, to) и страница перерендеривается на сервере.
 *
 * Селекты (month/day) пушат сразу, инпуты годов — через debounce.
 */
export function DayPicker({ month, day, fromYear, toYear }) {
  const searchParams = useSearchParams();
  const navigate = useDebouncedNavigate(300);
  const currentYear = new Date().getUTCFullYear();

  // Локальный state для инпутов годов — иначе ввод залипает пока крутится debounce.
  const [localFrom, setLocalFrom] = useState(fromYear ?? MIN_YEAR);
  const [localTo, setLocalTo] = useState(toYear ?? currentYear);
  useEffect(() => setLocalFrom(fromYear ?? MIN_YEAR), [fromYear]);
  useEffect(() => setLocalTo(toYear ?? currentYear), [toYear]);

  function buildUrl(patch) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    return `/this-day?${params.toString()}`;
  }

  const maxDay = DAYS_IN_MONTH[(month ?? 1) - 1];
  const safeDay = Math.min(day ?? 1, maxDay);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">Месяц</span>
        <select
          value={month ?? 1}
          onChange={(e) => {
            const m = Number(e.target.value);
            const newMax = DAYS_IN_MONTH[m - 1];
            navigate(buildUrl({ month: m, day: Math.min(day ?? 1, newMax) }), { immediate: true });
          }}
          className="px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                     text-fg focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition
                     [&>option]:bg-bg-deep [&>option]:text-fg"
        >
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">День</span>
        <select
          value={safeDay}
          onChange={(e) => navigate(buildUrl({ day: Number(e.target.value) }), { immediate: true })}
          className="px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                     text-fg focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition
                     [&>option]:bg-bg-deep [&>option]:text-fg"
        >
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">Годы</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={MIN_YEAR}
            max={currentYear}
            value={localFrom}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), MIN_YEAR, currentYear);
              setLocalFrom(v);
              navigate(buildUrl({ from: v }));
            }}
            className="w-24 px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                       text-fg tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition"
          />
          <span className="text-fg-muted">—</span>
          <input
            type="number"
            min={MIN_YEAR}
            max={currentYear}
            value={localTo}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), MIN_YEAR, currentYear);
              setLocalTo(v);
              navigate(buildUrl({ to: v }));
            }}
            className="w-24 px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                       text-fg tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 ml-0 sm:ml-2">
        <PresetButton onClick={() => navigate(buildUrl({ from: MIN_YEAR, to: currentYear }), { immediate: true })}>
          С 1979
        </PresetButton>
        <PresetButton onClick={() => navigate(buildUrl({ from: 2000, to: currentYear }), { immediate: true })}>
          С 2000
        </PresetButton>
        <PresetButton onClick={() => navigate(buildUrl({ from: currentYear - 9, to: currentYear }), { immediate: true })}>
          10 лет
        </PresetButton>
      </div>
    </div>
  );
}

function PresetButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs rounded-full bg-surface border border-stroke backdrop-blur
                 hover:bg-surface-strong hover:border-stroke-strong transition"
    >
      {children}
    </button>
  );
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}
