// Обёртки над Open-Meteo:
// - searchLocations()  — geocoding (поиск города по строке)
// - fetchHourly()      — почасовая погода с автороутингом archive/forecast по дате
//
// Open-Meteo бесплатна для некоммерческого использования, без ключа.
// Архив ERA5 имеет задержку ~5 дней, поэтому для последних дней используем forecast API
// (он умеет past_days до 92).
import "server-only";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

// Поля, которые Prisma-схема ожидает в hourly_weather.
// Порядок здесь = порядок в URL — Open-Meteo вернёт массивы в том же порядке.
const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "rain",
  "snowfall",
  "pressure_msl",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "weather_code",
];

// Архив отстаёт ~5 дней. Безопасный порог: today - 6.
// Для дат позже этого порога — forecast API (там `past_days` достаёт прошлое).
const ARCHIVE_LAG_DAYS = 6;

// Open-Meteo возвращает 429 при слишком большом числе одновременных запросов
// и/или при превышении лимита по минуте (бесплатный тариф: 600/мин).
// Стратегия: глобальный лимит параллелизма + экспоненциальный retry с jitter.
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1500;
// Минимальный интервал между стартами запросов (мс) — мягко гасит бёрст.
const MIN_REQUEST_INTERVAL_MS = 120;

// Поиск места по тексту. Возвращает массив кандидатов от Open-Meteo как есть
// (минимально нормализуя поля под нашу модель Location).
export async function searchLocations(query, { language = "ru", count = 10 } = {}) {
  const trimmed = String(query ?? "").trim();
  if (trimmed.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");

  const res = await limitedFetch(url, "geocoding");
  if (!res.ok) {
    throw new Error(`Open-Meteo geocoding ${res.status}: ${await safeReadText(res)}`);
  }
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    name: r.name,
    country: r.country_code ?? null,
    admin1: r.admin1 ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? null,
  }));
}

// Главный метод: получить почасовые данные за диапазон дат.
// startDate / endDate — строки 'YYYY-MM-DD' (включительно).
// Возвращает: { hours: [{ timestamp: Date, source, ...поля }], meta: { lat, lon, timezone } }
export async function fetchHourly({ latitude, longitude, startDate, endDate }) {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (start > end) {
    throw new Error(`fetchHourly: startDate ${startDate} > endDate ${endDate}`);
  }

  const cutoff = todayUTC();
  cutoff.setUTCDate(cutoff.getUTCDate() - ARCHIVE_LAG_DAYS);
  // cutoff — последний день, для которого архив гарантированно доступен.

  const ranges = [];
  if (start <= cutoff) {
    const archiveEnd = end <= cutoff ? end : cutoff;
    ranges.push({
      provider: "archive",
      url: ARCHIVE_URL,
      from: formatISODate(start),
      to: formatISODate(archiveEnd),
    });
  }
  if (end > cutoff) {
    const forecastStart = start > cutoff ? start : addDays(cutoff, 1);
    ranges.push({
      provider: "forecast",
      url: FORECAST_URL,
      from: formatISODate(forecastStart),
      to: formatISODate(end),
    });
  }

  // Тянем оба провайдера параллельно
  const responses = await Promise.all(ranges.map(fetchRange.bind(null, { latitude, longitude })));

  const hours = responses.flatMap((r) => r.hours);
  // координаты/таймзона — берём из первого ответа (для одной точки они совпадают)
  const meta = responses[0]
    ? { latitude: responses[0].latitude, longitude: responses[0].longitude, timezone: responses[0].timezone }
    : { latitude, longitude, timezone: null };

  return { hours, meta };
}

// --- внутреннее: лимитер параллелизма + минимальный интервал между стартами ---

let activeRequests = 0;
const waitQueue = [];
let lastRequestStartedAt = 0;

async function acquireSlot() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    await new Promise((resolve) => waitQueue.push(resolve));
  } else {
    activeRequests++;
  }
  // мягкий пейс между стартами — даже если слот свободен, не спамим один за другим
  const now = Date.now();
  const wait = lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastRequestStartedAt = Date.now();
}

function releaseSlot() {
  const next = waitQueue.shift();
  if (next) {
    // отдаём слот следующему — счётчик не трогаем
    next();
  } else {
    activeRequests--;
  }
}

// --- fetch с лимитером и retry на 429/5xx ---

async function limitedFetch(url, label) {
  await acquireSlot();
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let res;
      try {
        res = await fetch(url, { cache: "no-store" });
      } catch (networkErr) {
        // Сетевые ошибки тоже ретраим
        if (attempt === MAX_RETRIES) throw networkErr;
        await sleep(backoffMs(attempt));
        continue;
      }

      // Успех или клиентская ошибка кроме 429 — отдаём как есть
      if (res.status !== 429 && res.status < 500) {
        return res;
      }

      // 429 / 5xx — отступаем и ретраим
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const delay = retryAfter ?? backoffMs(attempt);

      // Тело может пригодиться в финальной ошибке — читаем и сохраняем
      const body = await safeReadText(res);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Open-Meteo ${label} ${res.status} после ${MAX_RETRIES + 1} попыток: ${body}`);
      }
      await sleep(delay);
    }
    // unreachable
    throw new Error(`Open-Meteo ${label}: исчерпаны ретраи`);
  } finally {
    releaseSlot();
  }
}

function backoffMs(attempt) {
  // экспонента + jitter, чтобы 47 параллельных задач не ретраили синхронно
  const base = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.4 + 0.8; // 0.8..1.2
  return Math.min(base * jitter, 15000);
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  // HTTP-date вариант — игнорируем для простоты
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// --- внутреннее: запрос одного диапазона ---

async function fetchRange({ latitude, longitude }, range) {
  const url = new URL(range.url);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", range.from);
  url.searchParams.set("end_date", range.to);
  url.searchParams.set("hourly", HOURLY_FIELDS.join(","));
  // храним всё в UTC — преобразуем в локальную TZ только при выводе
  url.searchParams.set("timezone", "UTC");

  const res = await limitedFetch(url, range.provider);
  if (!res.ok) {
    throw new Error(`Open-Meteo ${range.provider} ${res.status}: ${await safeReadText(res)}`);
  }
  const data = await res.json();
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone ?? "UTC",
    hours: normalizeHourly(data, range.provider),
  };
}

// Open-Meteo отдаёт hourly как «параллельные массивы»: time[i] соответствует temperature_2m[i] и т.д.
// Превращаем это в массив объектов с уже типизированными полями + Date в UTC.
function normalizeHourly(data, source) {
  const hourly = data.hourly;
  if (!hourly?.time?.length) return [];
  const times = hourly.time;
  const out = new Array(times.length);
  for (let i = 0; i < times.length; i++) {
    // time приходит как 'YYYY-MM-DDTHH:mm', без зоны. Мы попросили timezone=UTC, значит это UTC.
    const timestamp = new Date(`${times[i]}:00Z`);
    out[i] = {
      timestamp,
      source,
      temperature_2m: hourly.temperature_2m?.[i] ?? null,
      apparent_temperature: hourly.apparent_temperature?.[i] ?? null,
      relative_humidity_2m: hourly.relative_humidity_2m?.[i] ?? null,
      precipitation: hourly.precipitation?.[i] ?? null,
      rain: hourly.rain?.[i] ?? null,
      snowfall: hourly.snowfall?.[i] ?? null,
      pressure_msl: hourly.pressure_msl?.[i] ?? null,
      cloud_cover: hourly.cloud_cover?.[i] ?? null,
      wind_speed_10m: hourly.wind_speed_10m?.[i] ?? null,
      wind_direction_10m: hourly.wind_direction_10m?.[i] ?? null,
      wind_gusts_10m: hourly.wind_gusts_10m?.[i] ?? null,
      weather_code: hourly.weather_code?.[i] ?? null,
    };
  }
  return out;
}

function parseISODate(s) {
  // 'YYYY-MM-DD' → Date в UTC полночь
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
