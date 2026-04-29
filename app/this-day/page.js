import { Suspense } from "react";
import { LocationPicker } from "../components/LocationPicker";
import { DayPicker } from "../components/DayPicker";
import { YearsView } from "../components/YearsView";
import { getDayAcrossYears } from "@/lib/weather-service";

const MIN_YEAR = 1979;

// Динамический <title>: если выбрано место — "«Этот день» в Москве — Погода",
// иначе — дефолтный заголовок из layout.
export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const parsed = parseParams(sp);
  const name = parsed.location?.name;
  return name ? { title: `«Этот день» в ${name}` } : { title: "«Этот день» в разные годы" };
}

export default async function ThisDayPage({ searchParams }) {
  const sp = await searchParams;
  const parsed = parseParams(sp);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight">
          <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 dark:from-amber-300 dark:via-orange-300 dark:to-rose-300 bg-clip-text text-transparent">
            Этот день в разные годы
          </span>
        </h1>
        <p className="text-xs text-fg-muted mt-2">
          Выберите место и календарный день — увидите, какая погода была в этот день в разные годы.
        </p>
      </header>

      <section className="mb-8 space-y-4">
        <Suspense fallback={<PickerSkeleton />}>
          <LocationPicker current={parsed.location} />
        </Suspense>

        {parsed.location && (
          <Suspense fallback={null}>
            <DayPicker
              month={parsed.month}
              day={parsed.day}
              fromYear={parsed.fromYear}
              toYear={parsed.toYear}
            />
          </Suspense>
        )}
      </section>

      {parsed.location ? (
        <YearsSection
          location={parsed.location}
          month={parsed.month}
          day={parsed.day}
          fromYear={parsed.fromYear}
          toYear={parsed.toYear}
          sort={parsed.sort}
          dir={parsed.dir}
          searchString={parsed.searchString}
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

async function YearsSection({ location, month, day, fromYear, toYear, sort, dir, searchString }) {
  let years;
  try {
    years = await getDayAcrossYears({ location, month, day, fromYear, toYear });
  } catch (err) {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-400/30 p-6 text-accent-hot">
        <div className="font-medium mb-1">Не удалось загрузить данные</div>
        <div className="text-sm opacity-80">{String(err?.message ?? err)}</div>
      </div>
    );
  }

  return (
    <YearsView
      years={years}
      location={location}
      month={month}
      day={day}
      sort={sort}
      dir={dir}
      searchString={searchString}
    />
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-10 text-center">
      <div className="text-6xl mb-4" aria-hidden>📅</div>
      <div className="text-xl text-fg-soft mb-2">Выберите место</div>
      <div className="text-sm text-fg-muted max-w-sm mx-auto">
        После выбора локации появится выбор месяца, дня и диапазона годов.
      </div>
    </div>
  );
}

function PickerSkeleton() {
  return <div className="h-12 rounded-xl bg-surface border border-stroke animate-pulse" />;
}

// --- разбор параметров ---

const VALID_SORTS = new Set(["year", "max", "min", "mean", "precip"]);
const VALID_DIRS = new Set(["asc", "desc"]);

function parseParams(sp) {
  const lat = parseFloat(sp.lat);
  const lon = parseFloat(sp.lon);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);
  const today = new Date();
  const currentYear = today.getUTCFullYear();

  const month = clampInt(parseInt(sp.month, 10), 1, 12, today.getUTCMonth() + 1);
  const day = clampInt(parseInt(sp.day, 10), 1, 31, today.getUTCDate());
  const fromYear = clampInt(parseInt(sp.from, 10), MIN_YEAR, currentYear, MIN_YEAR);
  const toYear = clampInt(parseInt(sp.to, 10), MIN_YEAR, currentYear, currentYear);

  const sort = VALID_SORTS.has(sp.sort) ? sp.sort : "year";
  const dir = VALID_DIRS.has(sp.dir) ? sp.dir : "asc";

  // Сериализуем актуальные параметры для построения href в заголовках таблицы
  const search = new URLSearchParams();
  if (hasLocation) {
    search.set("lat", String(lat));
    search.set("lon", String(lon));
    if (typeof sp.name === "string") search.set("name", sp.name);
    if (typeof sp.country === "string") search.set("country", sp.country);
    if (typeof sp.admin1 === "string") search.set("admin1", sp.admin1);
    if (typeof sp.tz === "string") search.set("tz", sp.tz);
  }
  search.set("month", String(month));
  search.set("day", String(day));
  search.set("from", String(fromYear));
  search.set("to", String(toYear));

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
    month,
    day,
    fromYear: Math.min(fromYear, toYear),
    toYear: Math.max(fromYear, toYear),
    sort,
    dir,
    searchString: search.toString(),
  };
}

function clampInt(n, lo, hi, dflt) {
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(n, lo), hi);
}
