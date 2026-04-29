/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // standalone-сборка: .next/standalone содержит минимальный server.js + только
  // нужные node_modules. Используется в Docker-образе для маленького runtime.
  output: "standalone",
};

export default nextConfig;
