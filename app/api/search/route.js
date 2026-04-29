// Geocoding-поиск для автодополнения в LocationPicker.
// GET /api/search?q=москва → массив кандидатов от Open-Meteo.
import { searchLocations } from "@/lib/openmeteo";

export async function GET(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  try {
    const results = await searchLocations(q, { language: "ru", count: 8 });
    return Response.json({ results });
  } catch (err) {
    return Response.json(
      { results: [], error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
