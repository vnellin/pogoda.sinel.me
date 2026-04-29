import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "./components/Nav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata = {
  title: "Погода — архив с 1979 года и прогноз",
  description:
    "Почасовая погода для любой точки мира: архив ERA5 с 1940 года и прогноз на 16 дней вперёд. Источник данных — Open-Meteo.",
};

// Скрипт против FOUC: ставит .light/.dark на <html> ДО гидрации.
// Читает выбор пользователя из localStorage; если выбора нет — следует системе.
const themeBootstrap = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.add(resolved);
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full bg-bg text-fg selection:bg-sky-400/40 selection:text-fg-strong">
        {/* Декоративный фон: радиальные «ауры» в оба угла */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-aura-1 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full bg-aura-2 blur-3xl" />
        </div>
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
