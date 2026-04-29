// Server Component: «один и тот же день в разные годы».
// На входе массив { year, hours, error }, рисует сводку, график тренда и таблицу по годам.
import Link from "next/link";
import { weatherInfo, dominantCode } from "@/lib/weather-codes";

export function YearsView({ years, location, month, day, sort = "year", dir = "asc", searchString = "" }) {
  // Свернём каждый год в дневной агрегат
  const stats = years.map(yearStats).filter((s) => s.year != null);
  const withData = stats.filter((s) => s.maxTemp != null);

  if (withData.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-8 text-center text-fg-muted">
        Данных за выбранный день не найдено.
      </div>
    );
  }

  const overall = computeOverall(withData);
  const dateLabel = formatMonthDay(month, day);

  return (
    <div className="space-y-6">
      <Hero overall={overall} location={location} dateLabel={dateLabel} />
      <TrendChart years={withData} />
      <YearTable
        years={stats}
        hottest={overall.hottestYear}
        coldest={overall.coldestYear}
        wettest={overall.wettestYear}
        sort={sort}
        dir={dir}
        searchString={searchString}
      />
    </div>
  );
}

// --- Hero: общая сводка по всем годам ---

function Hero({ overall, location, dateLabel }) {
  const dominant = weatherInfo(overall.dominantCode);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/15
                    border border-stroke backdrop-blur-xl p-6 sm:p-10 shadow-2xl">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-amber-400/30 blur-3xl" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-widest text-fg-muted mb-1">{dateLabel}</div>
          <div className="text-xs text-fg-muted">
            {overall.firstYear}–{overall.lastYear}{" "}
            ({overall.lastYear - overall.firstYear}{" "}
            {pluralRu(overall.lastYear - overall.firstYear, ["год", "года", "лет"])},{" "}
            {overall.yearsCount}{" "}
            {pluralRu(overall.yearsCount, ["наблюдение", "наблюдения", "наблюдений"])})
            {" · "}
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat label="Средний максимум" value={formatTemp(overall.meanMax)} accent="text-accent-hot" />
        <BigStat label="Средний минимум" value={formatTemp(overall.meanMin)} accent="text-accent-cold" />
        <BigStat label="Самый жаркий" value={`${formatTemp(overall.hottestTemp)}`} hint={`${overall.hottestYear} год`} accent="text-orange-600 dark:text-orange-300" />
        <BigStat label="Самый холодный" value={`${formatTemp(overall.coldestTemp)}`} hint={`${overall.coldestYear} год`} accent="text-cyan-700 dark:text-cyan-300" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-fg-soft">
        <span className="opacity-70">Чаще всего в этот день:</span>
        <span className="text-2xl" aria-hidden>{dominant.emoji}</span>
        <span>{dominant.label}</span>
        {overall.wettestYear != null && (
          <span className="ml-auto text-xs text-fg-muted">
            Самый дождливый — <span className="text-accent-cold">{overall.wettestYear}</span>{" "}
            ({overall.wettestPrecip.toFixed(1)} мм)
          </span>
        )}
      </div>
    </div>
  );
}

function BigStat({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl bg-surface border border-stroke px-4 py-3 backdrop-blur">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className={`mt-1 text-3xl font-light tabular-nums ${accent ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-fg-muted mt-0.5">{hint}</div>}
    </div>
  );
}

// --- Trend chart: температура по годам ---

function TrendChart({ years }) {
  if (years.length < 2) return null;

  const width = 1000;
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 32, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allTemps = years.flatMap((y) => [y.minTemp, y.maxTemp, y.meanTemp].filter((v) => v != null));
  const minT = Math.floor(Math.min(...allTemps));
  const maxT = Math.ceil(Math.max(...allTemps));
  const range = Math.max(maxT - minT, 1);

  const xs = (i) => padding.left + (i / (years.length - 1 || 1)) * innerW;
  const ys = (v) => padding.top + (1 - (v - minT) / range) * innerH;

  // Залитая полоса min..max за каждый год
  const minLine = years.map((y, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(y.minTemp)}`).join(" ");
  const maxLineRev = years
    .slice()
    .reverse()
    .map((y, i) => `L ${xs(years.length - 1 - i)} ${ys(y.maxTemp)}`)
    .join(" ");
  const bandPath = `${minLine} ${maxLineRev} Z`;

  const meanPath = years
    .map((y, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(y.meanTemp)}`)
    .join(" ");

  // Подписи оси: 4 равноотстоящих
  const ticks = 4;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => minT + (range * i) / ticks);
  const labelEvery = Math.max(1, Math.floor(years.length / 8));

  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-fg-muted">Температура по годам</div>
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <Legend color="rgb(56 189 248)" label="средняя" />
          <Legend color="rgb(56 189 248 / 0.25)" label="мин — макс" filled />
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(244 114 182)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0.35" />
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

        {/* Полоса min-max */}
        <path d={bandPath} fill="url(#bandGradient)" />

        {/* Линия средней */}
        <path d={meanPath} fill="none" stroke="rgb(56 189 248)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Точки на средней */}
        {years.map((y, i) => (
          <circle key={y.year} cx={xs(i)} cy={ys(y.meanTemp)} r="2.5" fill="rgb(56 189 248)" />
        ))}

        {/* Метки годов */}
        {years.map((y, i) =>
          i % labelEvery === 0 || i === years.length - 1 ? (
            <text key={y.year} x={xs(i)} y={height - 10} fontSize="11" fill="rgb(148 163 184)" textAnchor="middle">
              {y.year}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function Legend({ color, label, filled }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ background: filled ? color : "transparent", border: filled ? "none" : `2px solid ${color}` }}
      />
      <span>{label}</span>
    </span>
  );
}

// --- Year table ---

const COLUMNS = [
  { key: "year",   label: "Год",     align: "left",  numeric: false },
  { key: "weather", label: "Погода", align: "left",  sortable: false },
  { key: "max",    label: "Макс",    align: "right", numeric: true },
  { key: "min",    label: "Мин",     align: "right", numeric: true },
  { key: "mean",   label: "Сред",    align: "right", numeric: true },
  { key: "precip", label: "Осадки",  align: "right", numeric: true },
];

function YearTable({ years, hottest, coldest, wettest, sort, dir, searchString }) {
  const sorted = sortYears(years, sort, dir);

  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-stroke flex items-center justify-between">
        <div className="text-sm text-fg-muted">Все годы</div>
        <div className="text-xs text-fg-muted">кликни по заголовку столбца для сортировки</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-fg-muted bg-surface border-b border-stroke">
              {COLUMNS.map((col) => (
                <Th
                  key={col.key}
                  col={col}
                  sort={sort}
                  dir={dir}
                  searchString={searchString}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((y) => (
              <YearRow
                key={y.year}
                y={y}
                hottest={hottest}
                coldest={coldest}
                wettest={wettest}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ col, sort, dir, searchString }) {
  const baseAlign = col.align === "right" ? "text-right" : "text-left";
  // Колонка «Погода» не сортируется
  if (col.sortable === false) {
    return <th className={`px-3 sm:px-4 py-3 font-medium ${baseAlign}`}>{col.label}</th>;
  }
  const isActive = sort === col.key;
  const nextDir = isActive && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(searchString);
  params.set("sort", col.key);
  params.set("dir", nextDir);
  const href = `/this-day?${params.toString()}`;
  const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "↕";
  const arrowClass = isActive ? "text-accent-cold" : "text-fg-faint";

  return (
    <th className={`px-3 sm:px-4 py-3 font-medium ${baseAlign}`}>
      <Link
        href={href}
        scroll={false}
        prefetch={false}
        className="inline-flex items-center gap-1.5 hover:text-fg transition"
      >
        <span>{col.label}</span>
        <span className={`text-[10px] ${arrowClass}`}>{arrow}</span>
      </Link>
    </th>
  );
}

function YearRow({ y, hottest, coldest, wettest }) {
  const isHot = y.year === hottest;
  const isCold = y.year === coldest;
  const isWet = y.year === wettest;
  const info = y.error ? null : weatherInfo(y.dominantCode);

  return (
    <tr
      className={`border-b border-stroke last:border-b-0 transition
        ${y.error ? "opacity-50" : "hover:bg-surface"}
        ${isHot ? "bg-rose-500/5" : ""}
        ${isCold ? "bg-cyan-500/5" : ""}`}
    >
      <td className="px-3 sm:px-4 py-3 tabular-nums">
        <span className="text-base">{y.year}</span>
        <span className="ml-2 text-xs">
          {isHot && <span title="самый жаркий" className="mr-1">🔥</span>}
          {isCold && <span title="самый холодный" className="mr-1">❄️</span>}
        </span>
      </td>
      {y.error ? (
        <td colSpan={5} className="px-3 sm:px-4 py-3 text-accent-hot text-xs">
          {y.error}
        </td>
      ) : (
        <>
          <td className="px-3 sm:px-4 py-3">
            <span className="text-xl mr-2" aria-hidden>{info.emoji}</span>
            <span className="text-fg-soft">{info.label}</span>
          </td>
          <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-accent-hot">
            {formatTemp(y.maxTemp)}
          </td>
          <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-accent-cold">
            {formatTemp(y.minTemp)}
          </td>
          <td className="px-3 sm:px-4 py-3 text-right tabular-nums text-fg-soft">
            {formatTemp(y.meanTemp)}
          </td>
          <td className="px-3 sm:px-4 py-3 text-right tabular-nums">
            {y.totalPrecip > 0 ? (
              <span className={isWet ? "text-accent-cold font-medium" : "text-sky-400/80"}>
                {y.totalPrecip.toFixed(1)} мм
                {isWet && <span className="ml-1" title="дождливее всех">💧</span>}
              </span>
            ) : (
              <span className="text-fg-faint">—</span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

// Сортировка с устойчивой обработкой строк-без-данных: они всегда уезжают в конец.
function sortYears(years, sort, dir) {
  const factor = dir === "desc" ? -1 : 1;
  const value = (y) => {
    if (y.error) return null;
    switch (sort) {
      case "max":    return y.maxTemp;
      case "min":    return y.minTemp;
      case "mean":   return y.meanTemp;
      case "precip": return y.totalPrecip;
      case "year":
      default:       return y.year;
    }
  };
  return years.slice().sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // null всегда в конец
    if (va == null && vb == null) return a.year - b.year;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va === vb) return a.year - b.year; // тай-брейк по году по возрастанию
    return (va - vb) * factor;
  });
}

// --- helpers ---

function yearStats({ year, hours, error }) {
  if (error || !hours || hours.length === 0) {
    return { year, error: error ?? "нет данных" };
  }
  const temps = hours.map((h) => h.temperature2m).filter((v) => v != null);
  if (temps.length === 0) return { year, error: "нет данных" };
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const meanTemp = temps.reduce((s, v) => s + v, 0) / temps.length;
  const totalPrecip = hours.reduce((s, h) => s + (h.precipitation ?? 0), 0);
  const code = dominantCode(hours.map((h) => h.weatherCode));
  return { year, minTemp, maxTemp, meanTemp, totalPrecip, dominantCode: code, error: null };
}

function computeOverall(stats) {
  const yearsCount = stats.length;
  const meanMax = stats.reduce((s, x) => s + x.maxTemp, 0) / yearsCount;
  const meanMin = stats.reduce((s, x) => s + x.minTemp, 0) / yearsCount;

  let hottest = stats[0];
  let coldest = stats[0];
  let wettest = stats[0];
  let firstYear = stats[0].year;
  let lastYear = stats[0].year;
  for (const s of stats) {
    if (s.maxTemp > hottest.maxTemp) hottest = s;
    if (s.minTemp < coldest.minTemp) coldest = s;
    if (s.totalPrecip > wettest.totalPrecip) wettest = s;
    if (s.year < firstYear) firstYear = s.year;
    if (s.year > lastYear) lastYear = s.year;
  }

  // Доминирующий weather-code за все годы суммарно
  const allCodes = stats.flatMap((s) => (s.dominantCode != null ? [s.dominantCode] : []));
  const dom = dominantCode(allCodes);

  return {
    yearsCount,
    firstYear,
    lastYear,
    meanMax,
    meanMin,
    hottestYear: hottest.year,
    hottestTemp: hottest.maxTemp,
    coldestYear: coldest.year,
    coldestTemp: coldest.minTemp,
    wettestYear: wettest.totalPrecip > 0 ? wettest.year : null,
    wettestPrecip: wettest.totalPrecip,
    dominantCode: dom,
  };
}

// Русский плюрал. forms = [одно, два, пять]
function pluralRu(n, [one, few, many]) {
  const m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return many;
  const m10 = n % 10;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

function formatTemp(v) {
  if (v == null) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r}°`;
}

function formatMonthDay(m, d) {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d} ${months[m - 1]}`;
}
