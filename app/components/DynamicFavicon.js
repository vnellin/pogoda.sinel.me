"use client";

import { useEffect } from "react";

// Динамическая favicon: SVG с emoji в data-URL. Браузеры предпочитают SVG-icon
// перед /favicon.ico, поэтому достаточно вставить <link rel="icon" type="image/svg+xml">.
export function DynamicFavicon({ emoji }) {
  useEffect(() => {
    if (!emoji) return;

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<text x="50" y="55" text-anchor="middle" dominant-baseline="central" font-size="80">${emoji}</text>` +
      `</svg>`;
    const href = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    let link = document.querySelector("link[rel='icon'][data-dynamic='1']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      link.dataset.dynamic = "1";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [emoji]);

  return null;
}
