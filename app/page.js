import { Suspense } from "react";
import { LocationPicker } from "./components/LocationPicker";
import { DateRangePicker } from "./components/DateRangePicker";
import { WeatherDisplay } from "./components/WeatherDisplay";
import { getWeather } from "@/lib/weather-service";

const MIN_DATE = "1979-01-01";
const MAX_FORECAST_DAYS = 4;

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const parsed = parseParams(sp);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-5xl font-light tracking-tight">
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 dark:from-sky-300 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
              Погода
            </span>
          </h1>
          <span className="text-xs text-fg-muted mt-2 hidden sm:inline">
            архив с 1979 года и прогноз
          </span>
        </div>
      </header>

      <section className="mb-8 space-y-4">
        <Suspense fallback={<PickerSkeleton />}>
          <LocationPicker current={parsed.location} />
        </Suspense>

        {parsed.location && (
          <Suspense fallback={null}>
            <DateRangePicker start={parsed.startDate} end={parsed.endDate} />
          </Suspense>
        )}
      </section>

      {parsed.location ? (
        <WeatherSection
          location={parsed.location}
          startDate={parsed.startDate}
          endDate={parsed.endDate}
        />
      ) : (
        <EmptyState />
      )}

      <footer className="mt-12 pt-6 border-t border-stroke text-xs text-fg-muted text-center">
        Данные{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-fg-soft"
        >
          Open-Meteo
        </a>{" "}
        — архив ERA5 и прогнозы Open-Meteo
      </footer>
    </main>
  );
}

async function WeatherSection({ location, startDate, endDate }) {
  let result;
  try {
    result = await getWeather({ location, startDate, endDate });
  } catch (err) {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-400/30 p-6 text-accent-hot">
        <div className="font-medium mb-1">Не удалось загрузить погоду</div>
        <div className="text-sm opacity-80">{String(err?.message ?? err)}</div>
      </div>
    );
  }

  return (
    <WeatherDisplay
      hours={result.hours}
      location={result.location}
      startDate={startDate}
      endDate={endDate}
    />
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-10 text-center">
      <div className="text-6xl mb-4" aria-hidden>🌍</div>
      <div className="text-xl text-fg-soft mb-2">Выберите место</div>
      <div className="text-sm text-fg-muted max-w-sm mx-auto">
        Начните вводить название города или нажмите «Моё место», чтобы использовать вашу геолокацию.
      </div>
    </div>
  );
}

function PickerSkeleton() {
  return <div className="h-12 rounded-xl bg-surface border border-stroke animate-pulse" />;
}

// --- разбор параметров ---

function parseParams(sp) {
  const lat = parseFloat(sp.lat);
  const lon = parseFloat(sp.lon);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);

  const today = todayISO();
  // По умолчанию показываем сегодня + весь доступный прогноз вперёд (today..today+MAX_FORECAST_DAYS)
  const defaultEnd = isoMax(today);
  const startRaw = typeof sp.start === "string" ? sp.start : today;
  const endRaw = typeof sp.end === "string" ? sp.end : defaultEnd;

  const startDate = clampDate(startRaw, today);
  const endDate = clampDate(endRaw, today);

  return {
    location: hasLocation
      ? {
          latitude: lat,
          longitude: lon,
          name: typeof sp.name === "string" ? sp.name : null,
          country: typeof sp.country === "string" ? sp.country : null,
          admin1: typeof sp.admin1 === "string" ? sp.admin1 : null,
          timezone: typeof sp.tz === "string" ? sp.tz : null,
        }
      : null,
    startDate,
    endDate,
  };
}

function clampDate(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return today;
  const max = isoMax(today);
  if (value < MIN_DATE) return MIN_DATE;
  if (value > max) return max;
  return value;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoMax(today) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + MAX_FORECAST_DAYS);
  return d.toISOString().slice(0, 10);
}
