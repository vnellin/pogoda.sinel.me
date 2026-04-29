// Обратное геокодирование: координаты → название города/региона/страны + timezone.
//
// Шаг 1: BigDataCloud — координаты → name/admin1/country.
//   Если задан BIGDATACLOUD_API_KEY — используем платный endpoint /reverse-geocode (точнее).
//   Иначе — бесплатный /reverse-geocode-client (без ключа, CORS-friendly).
//
// Шаг 2: Open-Meteo forward geocode по найденному имени — берём timezone у ближайшего
//   результата. При неудаче таймзона остаётся null (fetchHourly работает в UTC).
//
// GET /api/reverse-geocode?lat=55.75&lon=37.62 → { name, admin1, country, timezone }
import "server-only";
import { searchLocations } from "@/lib/openmeteo";

const BDC_FREE = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const BDC_PAID = "https://api.bigdatacloud.net/data/reverse-geocode";

export async function GET(request) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "lat и lon обязательны" }, { status: 400 });
  }

  // Не падаем, если внешние сервисы недоступны: отдаём что смогли получить,
  // null'ы клиент проглотит и пойдёт дальше с голыми координатами.
  const place = await reverseGeocodeBDC(lat, lon);
  const timezone = place.name ? await pickTimezone(place.name, lat, lon) : null;
  return Response.json({ ...place, timezone });
}

async function reverseGeocodeBDC(lat, lon) {
  const empty = { name: null, admin1: null, country: null };
  const key = process.env.BIGDATACLOUD_API_KEY?.trim();
  const u = new URL(key ? BDC_PAID : BDC_FREE);
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lon));
  u.searchParams.set("localityLanguage", "ru");
  if (key) u.searchParams.set("key", key);

  // Таймаут — чтобы клиент не висел на медленном/мёртвом upstream
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(u, { cache: "no-store", signal: controller.signal });
    if (!res.ok) {
      console.warn(`[reverse-geocode] BigDataCloud вернул ${res.status}`);
      return empty;
    }
    const data = await res.json();
    return {
      name: data.city || data.locality || null,
      admin1: data.principalSubdivision || null,
      country: data.countryCode || null,
    };
  } catch (err) {
    console.warn(`[reverse-geocode] BigDataCloud fetch упал:`, err?.message ?? err);
    return empty;
  } finally {
    clearTimeout(timeout);
  }
}

// Open-Meteo geocoding по имени, выбираем ближайший по координатам результат.
// Если расстояние > 100 км — считаем что не нашли (BDC мог ответить чем-то слишком общим).
async function pickTimezone(name, lat, lon) {
  try {
    const candidates = await searchLocations(name, { language: "ru", count: 5 });
    if (candidates.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = haversineKm(lat, lon, c.latitude, c.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (!best || bestDist > 100) return null;
    return best.timezone ?? null;
  } catch {
    return null;
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
