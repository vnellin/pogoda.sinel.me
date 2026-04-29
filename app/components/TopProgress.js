"use client";

import { useLoading } from "./LoadingProvider";

// Тонкая полоса прогресса сверху страницы. Видна когда useTransition.isPending=true,
// то есть пока RSC-навигация в полёте.
export function TopProgress() {
  const { isPending } = useLoading();
  return (
    <div
      aria-hidden
      className={`fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none overflow-hidden
                  transition-opacity duration-200 ${isPending ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className="h-full w-1/3 bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 rounded-full"
        style={{ animation: "pogoda-top-progress 1.2s ease-in-out infinite" }}
      />
    </div>
  );
}
