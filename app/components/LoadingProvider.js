"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

// Контекст загрузки: всё, что меняет URL (router.push/replace), оборачиваем
// в startTransition, чтобы isPending показывал индикатор сверху страницы.
const LoadingContext = createContext({
  isPending: false,
  startLoading: (fn) => fn(),
});

export function LoadingProvider({ children }) {
  const [isPending, startTransition] = useTransition();
  const value = { isPending, startLoading: startTransition };
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  return useContext(LoadingContext);
}

// Хук для дебоунсенной навигации.
// Использование:
//   const navigate = useDebouncedNavigate(300);
//   navigate("/?lat=...&lon=...");                       // через 300мс
//   navigate("/?lat=...", { immediate: true });          // сразу
//   navigate("/?lat=...", { replace: true });            // через router.replace
//
// Каждый новый вызов отменяет предыдущий таймер — старый push не выполнится.
// Когда push реально стартует — Next.js сам отменяет в-полёте RSC-запросы.
export function useDebouncedNavigate(delay = 300) {
  const router = useRouter();
  const { startLoading } = useLoading();
  const timeoutRef = useRef(null);

  // на анмаунт — гасим таймер, чтобы не выстрелил после ухода со страницы
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return useCallback(
    (href, options = {}) => {
      clearTimeout(timeoutRef.current);
      const run = () => {
        startLoading(() => {
          if (options.replace) router.replace(href);
          else router.push(href);
        });
      };
      if (options.immediate || delay === 0) run();
      else timeoutRef.current = setTimeout(run, delay);
    },
    [delay, router, startLoading],
  );
}
