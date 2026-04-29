// Server Component (без 'use client'): получает уже загруженные часы и рисует UI.
import { weatherInfo, dominantCode } from "@/lib/weather-codes";
import { DynamicFavicon } from "./DynamicFavicon";
import { TemperatureChartClient } from "./TemperatureChartClient";

export function WeatherDisplay({ hours, location, startDate, endDate }) {
  if (hours.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-8 text-center text-fg-muted">
        Данных за выбранный диапазон не найдено.
      </div>
    );
  }

  const snapshot = pickSnapshot(hours);
  const snapshotInfo = weatherInfo(snapshot.weatherCode);
  const days = groupByDay(hours);
  const isMultiDay = days.length > 1;

  return (
    <div className="space-y-6">
      <DynamicFavicon emoji={snapshotInfo.emoji} />
      <HeroCard hour={snapshot} location={location} startDate={startDate} endDate={endDate} />
      <TemperatureChartClient hours={hours} />
      {isMultiDay && <DailyCards days={days} />}
    </div>
  );
}

// --- Hero: крупная плитка с «снимком» погоды ---

function HeroCard({ hour, location, startDate, endDate }) {
  const info = weatherInfo(hour.weatherCode);
  const tz = location.timezone;
  const dt = new Date(hour.timestamp);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500/20 via-indigo-500/10 to-purple-500/20
                    border border-stroke backdrop-blur-xl p-6 sm:p-10 shadow-2xl">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-400/30 blur-3xl" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-widest text-fg-muted mb-1">
            {startDate === endDate ? formatDateLong(startDate) : `${formatDateLong(startDate)} — ${formatDateLong(endDate)}`}
          </div>
          <div className="text-xs text-fg-muted">
            Снимок на {formatDateTime(dt, tz)} {tz ? `(${tz})` : "(UTC)"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-fg-muted">
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-6 sm:gap-10">
        <div className="text-7xl sm:text-9xl leading-none" aria-hidden>
          {info.emoji}
        </div>
        <div>
          <div className="text-6xl sm:text-8xl font-light tabular-nums tracking-tight">
            {formatTemp(hour.temperature2m)}
          </div>
          <div className="mt-2 text-xl text-fg-soft">{info.label}</div>
          {hour.apparentTemperature != null && (
            <div className="mt-1 text-sm text-fg-muted">
              Ощущается как {formatTemp(hour.apparentTemperature)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Влажность" value={hour.relativeHumidity2m != null ? `${hour.relativeHumidity2m}%` : "—"} />
        <Stat label="Давление" value={formatPressure(hour.pressureMsl)} />
        <Stat
          label="Ветер"
          value={
            hour.windSpeed10m != null
              ? `${Math.round(hour.windSpeed10m)} км/ч ${windArrow(hour.windDirection10m)}`
              : "—"
          }
          hint={hour.windGusts10m != null ? `порывы до ${Math.round(hour.windGusts10m)}` : undefined}
        />
        <Stat
          label="Осадки"
          value={hour.precipitation != null ? `${hour.precipitation.toFixed(1)} мм` : "—"}
          hint={precipHint(hour)}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-surface border border-stroke px-4 py-3 backdrop-blur">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-1 text-lg tabular-nums">{value}</div>
      {hint && <div className="text-xs text-fg-muted mt-0.5">{hint}</div>}
    </div>
  );
}

// --- Daily table ---

function DailyCards({ days }) {
  const today = new Date().toISOString().slice(0, 10);
  // Новые даты сверху
  const ordered = days.slice().reverse();
  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-stroke">
        <div className="text-sm text-fg-muted">По дням</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-fg-muted bg-surface border-b border-stroke">
              <th className="px-3 sm:px-4 py-3 font-medium text-left">Дата</th>
              <th className="px-3 sm:px-4 py-3 font-medium text-left">Погода</th>
              <th className="px-3 sm:px-4 py-3 font-medium text-right">Макс</th>
              <th className="px-3 sm:px-4 py-3 font-medium text-right">Мин</th>
              <th className="px-3 sm:px-4 py-3 font-medium text-right">Сред</th>
              <th className="px-3 sm:px-4 py-3 font-medium text-right">Осадки</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((d) => {
              const info = weatherInfo(d.dominantCode);
              const isToday = d.dateKey === today;
              return (
                <tr
                  key={d.dateKey}
                  className={`border-b border-stroke last:border-b-0 transition hover:bg-surface
                              ${isToday ? "bg-sky-500/5" : ""}`}
                >
                  <td className="px-3 sm:px-4 py-3">
                    <div className="text-base">{formatShortDate(d.dateKey)}</div>
                    {isToday && <div className="text-[10px] text-accent-cold uppercase tracking-wider">сегодня</div>}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <span className="text-xl mr-2" aria-hidden>{info.emoji}</span>
                    <span className="text-fg-soft">{info.label}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-accent-hot">
                    {formatTemp(d.maxTemp)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-accent-cold">
                    {formatTemp(d.minTemp)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-fg-soft">
                    {formatTemp(d.meanTemp)}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-right tabular-nums">
                    {d.totalPrecip > 0 ? (
                      <span className="text-sky-400/80">{d.totalPrecip.toFixed(1)} мм</span>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- helpers ---

function pickSnapshot(hours) {
  // Возвращаем час, ближайший к «сейчас»; если now вне диапазона — берём ближайший к нему край.
  const now = Date.now();
  let best = hours[0];
  let bestDelta = Math.abs(new Date(hours[0].timestamp).getTime() - now);
  for (let i = 1; i < hours.length; i++) {
    const delta = Math.abs(new Date(hours[i].timestamp).getTime() - now);
    if (delta < bestDelta) {
      best = hours[i];
      bestDelta = delta;
    }
  }
  return best;
}

function groupByDay(hours) {
  const groups = new Map();
  for (const h of hours) {
    const key = h.timestamp.slice(0, 10); // 'YYYY-MM-DD' в UTC
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, items]) => {
      const temps = items.map((h) => h.temperature2m).filter((v) => v != null);
      return {
        dateKey,
        items,
        minTemp: temps.length ? Math.min(...temps) : null,
        maxTemp: temps.length ? Math.max(...temps) : null,
        meanTemp: temps.length ? temps.reduce((s, v) => s + v, 0) / temps.length : null,
        totalPrecip: items.reduce((s, h) => s + (h.precipitation ?? 0), 0),
        dominantCode: dominantCode(items.map((h) => h.weatherCode)),
      };
    });
}

function formatTemp(v) {
  if (v == null) return "—";
  const rounded = Math.round(v);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

// Open-Meteo отдаёт давление в гПа. Норма ~1013 гПа = 760 мм рт. ст.
// 1 гПа = 0.750062 мм рт. ст.
function formatPressure(hPa) {
  if (hPa == null) return "—";
  return `${Math.round(hPa * 0.750062)} мм рт. ст.`;
}

function precipHint(h) {
  if (h.snowfall != null && h.snowfall > 0) return `снег ${h.snowfall.toFixed(1)} см`;
  if (h.rain != null && h.rain > 0) return `дождь`;
  return undefined;
}

function windArrow(deg) {
  if (deg == null) return "";
  // Стрелка указывает откуда дует ветер. 0° = с севера, поэтому стрелка вниз = с севера
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return arrows[idx];
}

function formatDateLong(iso) {
  // 'YYYY-MM-DD' → '15 июня 1985'
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d} ${months[m - 1]} ${y}`;
}

function formatShortDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d} ${months[m - 1]}`;
}

function formatDateTime(date, timezone) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: timezone || "UTC",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}
