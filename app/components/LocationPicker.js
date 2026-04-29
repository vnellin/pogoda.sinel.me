"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { enrichWithReverseGeocode, saveLocation } from "@/lib/location-storage";
import { useLoading } from "./LoadingProvider";

/**
 * Поиск места: ввод с автодополнением + кнопка геолокации браузера.
 * При выборе обновляет query-параметры URL — страница перерисуется на сервере.
 */
export function LocationPicker({ current }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { startLoading } = useLoading();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  // Сохраняем текущую выбранную локацию — при следующем заходе LocationBootstrap
  // подхватит её из localStorage и сделает редирект сам.
  useEffect(() => {
    if (current) saveLocation(current);
  }, [current]);

  // Debounced поиск через /api/search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ac.signal });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        if (err.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Закрытие выпадашки по клику вне
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectLocation(loc) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", String(loc.latitude));
    params.set("lon", String(loc.longitude));
    if (loc.name) params.set("name", loc.name);
    else params.delete("name");
    if (loc.country) params.set("country", loc.country);
    else params.delete("country");
    if (loc.admin1) params.set("admin1", loc.admin1);
    else params.delete("admin1");
    if (loc.timezone) params.set("tz", loc.timezone);
    else params.delete("tz");
    startLoading(() => router.push(`${pathname}?${params.toString()}`));
    setQuery("");
    setResults([]);
    setOpen(false);
    setGeoError(null);
  }

  function useGeolocation() {
    if (geoLoading) return; // защита от повторных кликов
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Геолокация недоступна в этом браузере");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await enrichWithReverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          selectLocation(loc);
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        const messages = {
          1: "Доступ к геолокации запрещён",
          2: "Не удалось определить координаты",
          3: "Превышено время ожидания",
        };
        setGeoError(messages[err.code] ?? "Ошибка геолокации");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Текущая выбранная локация */}
      {current && (
        <div className="mb-3 flex items-center gap-2 text-sm text-fg-soft">
          <span className="opacity-70">Сейчас выбрано:</span>
          <span className="px-3 py-1 rounded-full bg-surface border border-stroke backdrop-blur">
            {formatPlaceName(current)}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="search"
            placeholder="Введите название города..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-stroke backdrop-blur
                       placeholder:text-fg-muted text-fg
                       focus:outline-none focus:ring-2 focus:ring-sky-400/60 focus:border-transparent
                       transition"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={useGeolocation}
          disabled={geoLoading}
          aria-busy={geoLoading}
          className="px-4 py-3 rounded-xl bg-surface border border-stroke backdrop-blur
                     hover:bg-surface-strong transition text-sm whitespace-nowrap
                     disabled:opacity-60 disabled:cursor-wait disabled:hover:bg-surface
                     inline-flex items-center gap-2"
          title="Использовать моё местоположение"
        >
          {geoLoading ? (
            <span
              className="inline-block w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
          ) : (
            <span aria-hidden>📍</span>
          )}
          <span className="hidden sm:inline">
            {geoLoading ? "Определяю…" : "Моё место"}
          </span>
        </button>
      </div>

      {geoError && (
        <p className="mt-2 text-sm text-accent-hot">{geoError}</p>
      )}

      {/* Выпадающий список результатов */}
      {open && results.length > 0 && (
        <ul
          className="absolute z-20 mt-2 w-full rounded-xl bg-bg-deep/95 border border-stroke
                     backdrop-blur-xl overflow-hidden shadow-2xl"
        >
          {results.map((r, i) => (
            <li key={`${r.latitude},${r.longitude},${i}`}>
              <button
                type="button"
                onClick={() => selectLocation(r)}
                className="w-full px-4 py-3 text-left hover:bg-surface-strong transition flex items-baseline justify-between gap-3"
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  {r.admin1 && r.admin1 !== r.name && (
                    <span className="text-fg-muted text-sm ml-2">{r.admin1}</span>
                  )}
                </span>
                <span className="text-xs text-fg-muted tabular-nums">
                  {r.country} · {r.latitude.toFixed(2)}, {r.longitude.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl bg-bg-deep/95 border border-stroke backdrop-blur-xl px-4 py-3 text-sm text-fg-muted">
          Ничего не нашлось
        </div>
      )}
    </div>
  );
}

function formatPlaceName(loc) {
  if (loc.name) {
    const parts = [loc.name];
    if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
    if (loc.country) parts.push(loc.country);
    return parts.join(", ");
  }
  return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
}
