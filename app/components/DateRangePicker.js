"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MIN_DATE = "1979-01-01";

/**
 * Выбор диапазона дат + быстрые пресеты.
 * Границы: с 1979-01-01 до сегодня + 4 дня (спец требование проекта).
 */
export function DateRangePicker({ start, end }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = todayUTC();
  const maxDate = formatISO(addDays(today, 4));

  function update(nextStart, nextEnd) {
    // если пользователь поставил end < start — поменяем местами
    let s = nextStart;
    let e = nextEnd;
    if (s && e && s > e) [s, e] = [e, s];
    const params = new URLSearchParams(searchParams.toString());
    if (s) params.set("start", s); else params.delete("start");
    if (e) params.set("end", e); else params.delete("end");
    router.push(`/?${params.toString()}`);
  }

  function applyPreset(preset) {
    const t = formatISO(today);
    if (preset === "today") update(t, t);
    else if (preset === "next4") update(t, formatISO(addDays(today, 4)));
    else if (preset === "week") update(formatISO(addDays(today, -6)), t);
    else if (preset === "month") update(formatISO(addDays(today, -29)), t);
    else if (preset === "year") update(formatISO(addDays(today, -364)), t);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">С</span>
        <input
          type="date"
          value={start ?? ""}
          min={MIN_DATE}
          max={maxDate}
          onChange={(e) => update(e.target.value, end)}
          className="px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                     text-fg focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">По</span>
        <input
          type="date"
          value={end ?? ""}
          min={MIN_DATE}
          max={maxDate}
          onChange={(e) => update(start, e.target.value)}
          className="px-3 py-2 rounded-lg bg-surface border border-stroke backdrop-blur
                     text-fg focus:outline-none focus:ring-2 focus:ring-sky-400/60 transition"
        />
      </label>

      <div className="flex flex-wrap gap-1.5 ml-0 sm:ml-2">
        <PresetButton onClick={() => applyPreset("today")}>Сегодня</PresetButton>
        <PresetButton onClick={() => applyPreset("next4")}>+4 дня</PresetButton>
        <PresetButton onClick={() => applyPreset("week")}>Неделя</PresetButton>
        <PresetButton onClick={() => applyPreset("month")}>Месяц</PresetButton>
        <PresetButton onClick={() => applyPreset("year")}>Год</PresetButton>
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

function todayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatISO(date) {
  return date.toISOString().slice(0, 10);
}
