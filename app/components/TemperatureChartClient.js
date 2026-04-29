"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dominantCode, weatherInfo } from "@/lib/weather-codes";

const HOURLY_LIMIT = 168; // если часов меньше — показываем почасово, иначе агрегируем по дням

export function TemperatureChartClient({ hours }) {
  if (!hours || hours.length < 2) return null;

  const isDaily = hours.length > HOURLY_LIMIT;
  const data = isDaily ? aggregateByDay(hours) : toHourly(hours);
  if (data.length < 2) return null;

  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-4 sm:p-6">
      <div className="text-sm text-fg-muted mb-3">
        Температура {isDaily ? "(средняя по дням)" : "(почасовая)"}
      </div>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => formatXLabel(ts, isDaily)}
              tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "rgb(148 163 184)", fontSize: 11 }}
              tickFormatter={(t) => `${Math.round(t)}°`}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={["dataMin - 1", "dataMax + 1"]}
            />
            <Tooltip
              cursor={{ stroke: "rgb(56 189 248)", strokeOpacity: 0.4, strokeDasharray: "4 4" }}
              content={<ChartTooltip isDaily={isDaily} />}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="temp"
              stroke="rgb(56 189 248)"
              strokeWidth={2}
              fill="url(#tempArea)"
              connectNulls
              activeDot={{ r: 4, fill: "rgb(56 189 248)", stroke: "var(--bg)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Кастомный tooltip — показывает дату, температуру, эмодзи погоды, влажность, ветер, осадки.
function ChartTooltip({ active, payload, isDaily }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const info = weatherInfo(d.weatherCode);
  return (
    <div className="rounded-xl bg-bg-deep/95 border border-stroke backdrop-blur-xl p-3 shadow-2xl text-sm min-w-[180px]">
      <div className="text-xs text-fg-muted mb-1">{d.fullLabel}</div>
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>{info.emoji}</span>
        <div>
          {isDaily ? (
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-xl text-accent-hot">{formatTemp(d.tempMax)}</span>
              <span className="text-fg-muted">/ {formatTemp(d.tempMin)}</span>
            </div>
          ) : (
            <div className="text-xl tabular-nums">{formatTemp(d.temp)}</div>
          )}
          <div className="text-xs text-fg-soft">{info.label}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-fg-muted tabular-nums">
        {d.humidity != null && (
          <div>Влажн.: <span className="text-fg-soft">{d.humidity}%</span></div>
        )}
        {d.windSpeed != null && (
          <div>Ветер: <span className="text-fg-soft">{Math.round(d.windSpeed)} км/ч</span></div>
        )}
        {d.precip != null && d.precip > 0 && (
          <div className="col-span-2">
            Осадки: <span className="text-accent-cold">{d.precip.toFixed(1)} мм</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- подготовка данных ---

function toHourly(hours) {
  return hours.map((h) => ({
    ts: new Date(h.timestamp).getTime(),
    temp: h.temperature2m,
    humidity: h.relativeHumidity2m,
    windSpeed: h.windSpeed10m,
    precip: h.precipitation,
    weatherCode: h.weatherCode,
    fullLabel: formatFullLabel(h.timestamp, false),
    isDaily: false,
  }));
}

function aggregateByDay(hours) {
  const groups = new Map();
  for (const h of hours) {
    const key = h.timestamp.slice(0, 10); // 'YYYY-MM-DD' UTC
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(h);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, items]) => {
      const temps = items.map((h) => h.temperature2m).filter((v) => v != null);
      const tempMean = temps.length ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
      const tempMin = temps.length ? Math.min(...temps) : null;
      const tempMax = temps.length ? Math.max(...temps) : null;
      const precip = items.reduce((s, h) => s + (h.precipitation ?? 0), 0);
      const humid = avg(items.map((h) => h.relativeHumidity2m));
      const wind = avg(items.map((h) => h.windSpeed10m));
      return {
        ts: new Date(`${dateKey}T12:00:00Z`).getTime(), // середина дня — для размещения по оси X
        temp: tempMean,
        tempMin,
        tempMax,
        humidity: humid != null ? Math.round(humid) : null,
        windSpeed: wind,
        precip,
        weatherCode: dominantCode(items.map((h) => h.weatherCode)),
        fullLabel: formatFullLabel(`${dateKey}T00:00:00Z`, true),
        isDaily: true,
      };
    });
}

function avg(values) {
  const xs = values.filter((v) => v != null);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

function formatXLabel(ts, isDaily) {
  const d = new Date(ts);
  if (isDaily) {
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  }
  return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

function formatFullLabel(ts, isDaily) {
  const d = new Date(ts);
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const dd = d.getUTCDate();
  const mm = months[d.getUTCMonth()];
  const yy = d.getUTCFullYear();
  if (isDaily) return `${dd} ${mm} ${yy}`;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  return `${dd} ${mm} ${yy}, ${hh}:00`;
}

function formatTemp(v) {
  if (v == null) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r}°`;
}
