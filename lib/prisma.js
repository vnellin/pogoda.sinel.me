// Singleton Prisma Client с MariaDB-адаптером (требование Prisma 7).
// В dev-режиме Next.js делает hot-reload — кешируем клиент в globalThis,
// чтобы не плодить пулы соединений на каждой перезагрузке.
import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createPrismaClient() {
  const adapter = new PrismaMariaDb(process.env.DATABASE_URL, {
    // имя БД для генерируемых запросов (адаптер берёт его из URL, дублируем явно)
    database: "pogoda",
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}
