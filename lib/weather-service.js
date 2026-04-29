// Сервисный слой: единая точка входа для UI.
// Логика: упсёртим Location → проверяем кэш в Prisma → если не хватает,
// дозапрашиваем Open-Meteo → сохраняем → отдаём всё за диапазон.
import "server-only";
import { prisma } from "./prisma";
import { fetchHourly } from "./openmeteo";

// Прогноз протухает быстрее архива. Перезапрашиваем не чаще раза в час.
const FORECAST_TTL_MS = 60 * 60 * 1000;

/**
 * Получить почасовую погоду за диапазон дат.
 * @param {{
 *   location: { latitude: number, longitude: number, name?: string|null,
 *               country?: string|null, admin1?: string|null, timezone?: string|null },
 *   startDate: string, // 'YYYY-MM-DD'
 *   endDate: string,   // 'YYYY-MM-DD'
 * }} args
 */
export async function getWeather({ location, startDate, endDate }) {
  const dbLocation = await upsertLocation(location);

  // Диапазон в UTC: [startDate 00:00:00, endDate 23:00:00] включительно
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:00:00Z`);
  const expectedHours = Math.floor((end.getTime() - start.getTime()) / 3600000) + 1;

  // 1. Лёгкий запрос — только метаданные имеющихся часов, чтобы решить, нужен ли API
  const existingMeta = await prisma.hourlyWeather.findMany({
    where: {
      locationId: dbLocation.id,
      timestamp: { gte: start, lte: end },
    },
    select: { timestamp: true, source: true, fetchedAt: true },
  });

  const ttlAgo = new Date(Date.now() - FORECAST_TTL_MS);
  const staleForecasts = existingMeta.filter(
    (h) => h.source === "forecast" && h.fetchedAt < ttlAgo,
  );
  const isComplete = existingMeta.length >= expectedHours;
  const cacheHit = isComplete && staleForecasts.length === 0;

  // 2. Если данных не хватает или прогноз протух — идём в Open-Meteo
  if (!cacheHit) {
    if (staleForecasts.length > 0) {
      await prisma.hourlyWeather.deleteMany({
        where: {
          locationId: dbLocation.id,
          timestamp: { gte: start, lte: end },
          source: "forecast",
          fetchedAt: { lt: ttlAgo },
        },
      });
    }

    const { hours } = await fetchHourly({
      latitude: Number(dbLocation.latitude),
      longitude: Number(dbLocation.longitude),
      startDate,
      endDate,
    });

    if (hours.length > 0) {
      await prisma.hourlyWeather.createMany({
        data: hours.map((h) => ({
          locationId: dbLocation.id,
          timestamp: h.timestamp,
          source: h.source,
          temperature2m: h.temperature_2m,
          apparentTemperature: h.apparent_temperature,
          relativeHumidity2m: h.relative_humidity_2m,
          precipitation: h.precipitation,
          rain: h.rain,
          snowfall: h.snowfall,
          pressureMsl: h.pressure_msl,
          cloudCover: h.cloud_cover,
          windSpeed10m: h.wind_speed_10m,
          windDirection10m: h.wind_direction_10m,
          windGusts10m: h.wind_gusts_10m,
          weatherCode: h.weather_code,
        })),
        // archive-записи иммутабельны; повторные часы пропускаем
        skipDuplicates: true,
      });
    }
  }

  // 3. Возвращаем всё что есть в БД за диапазон (отсортировано по времени)
  const records = await prisma.hourlyWeather.findMany({
    where: {
      locationId: dbLocation.id,
      timestamp: { gte: start, lte: end },
    },
    orderBy: { timestamp: "asc" },
  });

  return {
    location: serializeLocation(dbLocation),
    hours: records.map(serializeHour),
    cacheHit,
  };
}

/**
 * Найти или создать Location по координатам.
 * Координаты хранятся как Decimal(7,4) — округляем до 4 знаков для стабильности уникального индекса.
 */
async function upsertLocation(input) {
  const latitude = round4(input.latitude);
  const longitude = round4(input.longitude);

  return prisma.location.upsert({
    where: { latitude_longitude: { latitude, longitude } },
    create: {
      latitude,
      longitude,
      name: input.name ?? null,
      country: input.country ?? null,
      admin1: input.admin1 ?? null,
      timezone: input.timezone ?? null,
    },
    // если место уже было найдено — не перетираем имя
    update: {},
  });
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

// BigInt id и Decimal не сериализуются в JSON стандартно — приводим к примитивам
function serializeLocation(loc) {
  return {
    id: loc.id,
    latitude: Number(loc.latitude),
    longitude: Number(loc.longitude),
    name: loc.name,
    country: loc.country,
    admin1: loc.admin1,
    timezone: loc.timezone,
  };
}

/**
 * «Один и тот же день в разные годы».
 * Один upsert локации, один батч-запрос к БД на проверку кэша,
 * параллельные дозапросы к Open-Meteo для пропущенных лет, один createMany.
 *
 * @param {{
 *   location: { latitude, longitude, name?, country?, admin1?, timezone? },
 *   month: number, // 1..12
 *   day: number,   // 1..31
 *   fromYear: number,
 *   toYear: number,
 * }} args
 */
export async function getDayAcrossYears({ location, month, day, fromYear, toYear }) {
  const dbLocation = await upsertLocation(location);

  // 1. Сформировать список целевых дней (отфильтровав 29 февраля и заглядывание за горизонт прогноза)
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + 16);

  const targets = [];
  for (let year = fromYear; year <= toYear; year++) {
    if (month === 2 && day === 29 && !isLeapYear(year)) continue;
    const dateStr = formatYMD(year, month, day);
    const start = new Date(`${dateStr}T00:00:00Z`);
    if (start > horizon) continue;
    const end = new Date(`${dateStr}T23:00:00Z`);
    targets.push({ year, dateStr, start, end });
  }

  if (targets.length === 0) return [];

  // 2. Один findMany: тянем все имеющиеся записи под целевые дни одним OR-запросом
  const existing = await prisma.hourlyWeather.findMany({
    where: {
      locationId: dbLocation.id,
      OR: targets.map((t) => ({ timestamp: { gte: t.start, lte: t.end } })),
    },
    orderBy: { timestamp: "asc" },
  });

  // Группируем по дате (UTC, YYYY-MM-DD)
  const byDate = new Map();
  for (const h of existing) {
    const key = h.timestamp.toISOString().slice(0, 10);
    let bucket = byDate.get(key);
    if (!bucket) {
      bucket = [];
      byDate.set(key, bucket);
    }
    bucket.push(h);
  }

  // 3. Определить какие дни нужно дозапрашивать (нет 24 часов или есть устаревший прогноз)
  const ttlAgo = new Date(Date.now() - FORECAST_TTL_MS);
  const toFetch = targets.filter((t) => {
    const records = byDate.get(t.dateStr) ?? [];
    if (records.length < 24) return true;
    return records.some((h) => h.source === "forecast" && h.fetchedAt < ttlAgo);
  });

  // 4. Дозапрос к API параллельно
  if (toFetch.length > 0) {
    // Снести устаревшие forecast-записи, чтобы createMany не отскочил по unique
    await prisma.hourlyWeather.deleteMany({
      where: {
        locationId: dbLocation.id,
        OR: toFetch.map((t) => ({ timestamp: { gte: t.start, lte: t.end } })),
        source: "forecast",
        fetchedAt: { lt: ttlAgo },
      },
    });

    const settled = await Promise.allSettled(
      toFetch.map((t) =>
        fetchHourly({
          latitude: Number(dbLocation.latitude),
          longitude: Number(dbLocation.longitude),
          startDate: t.dateStr,
          endDate: t.dateStr,
        }),
      ),
    );

    // Собрать все новые записи и записать одним createMany
    const newRecords = [];
    const apiErrors = new Map(); // dateStr -> error
    for (let i = 0; i < toFetch.length; i++) {
      const r = settled[i];
      if (r.status !== "fulfilled") {
        apiErrors.set(toFetch[i].dateStr, String(r.reason?.message ?? r.reason));
        continue;
      }
      for (const h of r.value.hours) {
        newRecords.push({
          locationId: dbLocation.id,
          timestamp: h.timestamp,
          source: h.source,
          temperature2m: h.temperature_2m,
          apparentTemperature: h.apparent_temperature,
          relativeHumidity2m: h.relative_humidity_2m,
          precipitation: h.precipitation,
          rain: h.rain,
          snowfall: h.snowfall,
          pressureMsl: h.pressure_msl,
          cloudCover: h.cloud_cover,
          windSpeed10m: h.wind_speed_10m,
          windDirection10m: h.wind_direction_10m,
          windGusts10m: h.wind_gusts_10m,
          weatherCode: h.weather_code,
        });
      }
    }

    if (newRecords.length > 0) {
      await prisma.hourlyWeather.createMany({
        data: newRecords,
        skipDuplicates: true,
      });
      // Дозаливаем в byDate из новых записей (не делаем второй findMany)
      for (const rec of newRecords) {
        const key = rec.timestamp.toISOString().slice(0, 10);
        let bucket = byDate.get(key);
        if (!bucket) {
          bucket = [];
          byDate.set(key, bucket);
        }
        // если в bucket уже была запись на этот час из старого fetchа — заменяем
        const ts = rec.timestamp.getTime();
        const idx = bucket.findIndex(
          (h) => new Date(h.timestamp).getTime() === ts && h.source !== "archive",
        );
        if (idx >= 0) bucket[idx] = rec;
        else bucket.push(rec);
      }
    }

    // 5. Сформировать ответ с учётом возможных ошибок API
    return targets.map((t) => {
      const bucket = (byDate.get(t.dateStr) ?? []).slice().sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const apiErr = apiErrors.get(t.dateStr);
      return {
        year: t.year,
        dateStr: t.dateStr,
        hours: bucket.map(serializeHour),
        error: bucket.length === 0 ? apiErr ?? "нет данных" : null,
      };
    });
  }

  // 6. Полный кэш-хит
  return targets.map((t) => {
    const bucket = byDate.get(t.dateStr) ?? [];
    return {
      year: t.year,
      dateStr: t.dateStr,
      hours: bucket.map(serializeHour),
      error: bucket.length === 0 ? "нет данных" : null,
    };
  });
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function formatYMD(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function serializeHour(h) {
  return {
    timestamp: h.timestamp.toISOString(),
    source: h.source,
    temperature2m: h.temperature2m,
    apparentTemperature: h.apparentTemperature,
    relativeHumidity2m: h.relativeHumidity2m,
    precipitation: h.precipitation,
    rain: h.rain,
    snowfall: h.snowfall,
    pressureMsl: h.pressureMsl,
    cloudCover: h.cloudCover,
    windSpeed10m: h.windSpeed10m,
    windDirection10m: h.windDirection10m,
    windGusts10m: h.windGusts10m,
    weatherCode: h.weatherCode,
  };
}
