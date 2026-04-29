// Server Component (без 'use client'): получает уже загруженные часы и рисует UI.
import { weatherInfo, dominantCode } from "@/lib/weather-codes";
import { DynamicFavicon } from "./DynamicFavicon";

const DAY_MS = 24 * 60 * 60 * 1000;

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
      <TemperatureChart hours={hours} />
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
        <Stat label="Давление" value={hour.pressureMsl != null ? `${Math.round(hour.pressureMsl)} гПа` : "—"} />
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

// --- Temperature chart (SVG) ---

function TemperatureChart({ hours }) {
  // Если диапазон длинный — агрегируем по дням, иначе показываем все часы
  const points = hours.length > 168 ? aggregatePointsByDay(hours) : hours.map(hourPoint);
  if (points.length < 2) return null;

  const width = 1000;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 28, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const temps = points.map((p) => p.value).filter((v) => v != null);
  if (temps.length === 0) return null;
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const range = Math.max(maxT - minT, 1);

  const xs = (i) => padding.left + (i / (points.length - 1)) * innerW;
  const ys = (v) => padding.top + (1 - (v - minT) / range) * innerH;

  // Линия и заливка под ней
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(2)} ${ys(p.value).toFixed(2)}`)
    .join(" ");
  const areaPath =
    `M ${xs(0).toFixed(2)} ${(padding.top + innerH).toFixed(2)} ` +
    points.map((p, i) => `L ${xs(i).toFixed(2)} ${ys(p.value).toFixed(2)}`).join(" ") +
    ` L ${xs(points.length - 1).toFixed(2)} ${(padding.top + innerH).toFixed(2)} Z`;

  // 4 горизонтальные линии-оси
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minT + (range * i) / ticks);

  // Несколько меток оси X
  const labelEvery = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-4 sm:p-6">
      <div className="text-sm text-fg-muted mb-3">
        Температура {points.length > 168 ? "(средняя по дням)" : "(почасовая)"}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label="График температуры"
      >
        <defs>
          <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Сетка */}
        {tickValues.map((t, i) => {
          const y = padding.top + (1 - (t - minT) / range) * innerH;
          return (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgb(148 163 184 / 0.15)" strokeWidth="1" />
              <text x={padding.left - 8} y={y + 4} fontSize="11" fill="rgb(148 163 184)" textAnchor="end">
                {Math.round(t)}°
              </text>
            </g>
          );
        })}

        {/* Заливка */}
        <path d={areaPath} fill="url(#tempArea)" />
        {/* Линия */}
        <path d={linePath} fill="none" stroke="rgb(56 189 248)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Метки оси X */}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={xs(i)} y={height - 8} fontSize="11" fill="rgb(148 163 184)" textAnchor="middle">
              {p.xLabel}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

// --- Daily cards ---

function DailyCards({ days }) {
  return (
    <div>
      <div className="text-sm text-fg-muted mb-3">По дням</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {days.map((d) => {
          const info = weatherInfo(d.dominantCode);
          return (
            <div
              key={d.dateKey}
              className="rounded-xl bg-surface border border-stroke backdrop-blur p-4 hover:bg-surface-strong transition"
            >
              <div className="text-xs text-fg-muted">{formatShortDate(d.dateKey)}</div>
              <div className="text-3xl my-1" aria-hidden>{info.emoji}</div>
              <div className="text-sm text-fg-soft">{info.label}</div>
              <div className="mt-2 flex items-baseline gap-2 tabular-nums">
                <span className="text-lg">{formatTemp(d.maxTemp)}</span>
                <span className="text-sm text-fg-muted">/ {formatTemp(d.minTemp)}</span>
              </div>
              {d.totalPrecip > 0 && (
                <div className="mt-1 text-xs text-accent-cold">💧 {d.totalPrecip.toFixed(1)} мм</div>
              )}
            </div>
          );
        })}
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
    .map(([dateKey, items]) => ({
      dateKey,
      items,
      minTemp: Math.min(...items.map((h) => h.temperature2m).filter((v) => v != null)),
      maxTemp: Math.max(...items.map((h) => h.temperature2m).filter((v) => v != null)),
      totalPrecip: items.reduce((s, h) => s + (h.precipitation ?? 0), 0),
      dominantCode: dominantCode(items.map((h) => h.weatherCode)),
    }));
}

function hourPoint(h) {
  const d = new Date(h.timestamp);
  return {
    value: h.temperature2m,
    xLabel: `${String(d.getUTCHours()).padStart(2, "0")}:00`,
    timestamp: h.timestamp,
  };
}

function aggregatePointsByDay(hours) {
  const groups = new Map();
  for (const h of hours) {
    const key = h.timestamp.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    if (h.temperature2m != null) groups.get(key).push(h.temperature2m);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, temps]) => ({
      value: temps.length > 0 ? temps.reduce((s, v) => s + v, 0) / temps.length : null,
      xLabel: formatShortDate(dateKey),
      timestamp: dateKey,
    }));
}

function formatTemp(v) {
  if (v == null) return "—";
  const rounded = Math.round(v);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
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
