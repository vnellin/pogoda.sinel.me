// Smoke-тест бэкенда: search → первая локация → погода за указанную дату.
// Использование:
//   GET /api/smoke-test                        → Москва, сегодня
//   GET /api/smoke-test?city=Berlin            → Берлин, сегодня
//   GET /api/smoke-test?city=Минск&date=1985-06-15
//   GET /api/smoke-test?city=Tokyo&start=2024-01-01&end=2024-01-03
import { searchLocations } from "@/lib/openmeteo";
import { getWeather } from "@/lib/weather-service";

export async function GET(request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city") ?? "Москва";

  const today = new Date().toISOString().slice(0, 10);
  const startDate = url.searchParams.get("start") ?? url.searchParams.get("date") ?? today;
  const endDate = url.searchParams.get("end") ?? url.searchParams.get("date") ?? today;

  try {
    const candidates = await searchLocations(city);
    if (candidates.length === 0) {
      return Response.json({ ok: false, error: `geocoding: ничего не нашлось для "${city}"` }, { status: 404 });
    }
    const location = candidates[0];

    const t0 = performance.now();
    const result = await getWeather({ location, startDate, endDate });
    const elapsedMs = Math.round(performance.now() - t0);

    return Response.json({
      ok: true,
      query: { city, startDate, endDate },
      pickedLocation: location,
      cacheHit: result.cacheHit,
      elapsedMs,
      hoursReturned: result.hours.length,
      // показываем первый и последний час для проверки границ диапазона
      firstHour: result.hours[0] ?? null,
      lastHour: result.hours[result.hours.length - 1] ?? null,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message ?? err), stack: err?.stack },
      { status: 500 },
    );
  }
}
