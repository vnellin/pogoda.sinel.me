"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { enrichWithReverseGeocode, loadLocation } from "@/lib/location-storage";
import { useLoading } from "./LoadingProvider";

// Что показывать когда у пользователя нет ?lat=&lon= в URL:
// 1) если в localStorage есть последняя локация — редиректим на неё
// 2) иначе тихо просим navigator.geolocation
//    - получили → редирект
//    - отказ/ошибка → fallback EmptyState (как раньше)
export function LocationBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const { startLoading } = useLoading();
  // 'init' — пока useEffect не отработал; 'requesting' — спрашиваем geolocation;
  // 'failed' — нет ни сохранённой, ни геолокации (показываем EmptyState)
  const [status, setStatus] = useState("init");
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;

    // 1. Сохранённая локация — приоритет
    const saved = loadLocation();
    if (saved) {
      redirectTo(saved);
      return;
    }

    // 2. Запрос геолокации браузера
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("failed");
      return;
    }

    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = await enrichWithReverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        redirectTo(loc);
      },
      () => setStatus("failed"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redirectTo(loc) {
    const params = new URLSearchParams();
    params.set("lat", String(loc.latitude));
    params.set("lon", String(loc.longitude));
    if (loc.name) params.set("name", loc.name);
    if (loc.country) params.set("country", loc.country);
    if (loc.admin1) params.set("admin1", loc.admin1);
    if (loc.timezone) params.set("tz", loc.timezone);
    startLoading(() => router.replace(`${pathname}?${params.toString()}`));
  }

  if (status === "requesting") {
    return (
      <div className="rounded-2xl bg-surface border border-stroke backdrop-blur-xl p-10 text-center">
        <div className="text-6xl mb-4 animate-pulse" aria-hidden>📍</div>
        <div className="text-xl text-fg-soft mb-2">Определяю ваше местоположение…</div>
        <div className="text-sm text-fg-muted">Разрешите доступ к геолокации в браузере</div>
      </div>
    );
  }

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
