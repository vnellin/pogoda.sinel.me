// Хелперы для хранения последней выбранной локации в localStorage.
// Используется LocationPicker (сохраняет) и LocationBootstrap (читает).
export const LOCATION_STORAGE_KEY = "pogoda:last-location";

// Обогащает координаты названием города/региона/страны через /api/reverse-geocode.
// При любой ошибке отдаёт исходные координаты — UI всё равно покажет lat/lon.
export async function enrichWithReverseGeocode(latitude, longitude) {
  const base = { latitude, longitude };
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
    if (!res.ok) return base;
    const data = await res.json();
    return {
      ...base,
      name: data.name ?? null,
      admin1: data.admin1 ?? null,
      country: data.country ?? null,
      timezone: data.timezone ?? null,
    };
  } catch {
    return base;
  }
}

export function saveLocation(loc) {
  if (typeof window === "undefined" || !loc) return;
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // localStorage может быть недоступен (privacy mode, квота)
  }
}

export function loadLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const loc = JSON.parse(raw);
    if (!Number.isFinite(loc?.latitude) || !Number.isFinite(loc?.longitude)) return null;
    return loc;
  } catch {
    return null;
  }
}
