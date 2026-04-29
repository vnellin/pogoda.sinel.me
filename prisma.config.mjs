// Конфиг Prisma CLI (миграции).
// В Prisma 7 url/shadowDatabaseUrl переехали из schema.prisma сюда.
// .env не загружается автоматически — поднимаем через встроенный API Node.
import { defineConfig, env } from "@prisma/config";

process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
