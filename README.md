# Pogoda

Веб-приложение для просмотра исторической погоды (с 1940 г.) и прогноза до 16 дней
вперёд для произвольной геолокации. Данные тянутся из [Open-Meteo](https://open-meteo.com/),
кэшируются в MySQL — повторный запрос той же точки/часа берётся из БД.

## Стек

- [Next.js 16](https://nextjs.org) (App Router, React Compiler, standalone-сборка)
- React 19
- [Prisma 7](https://www.prisma.io/) + MySQL (адаптер `@prisma/adapter-mariadb`)
- Tailwind CSS 4
- Источник данных: Open-Meteo
  - архив ERA5: почасовые данные с 1940 г. (задержка ~5 дней)
  - прогноз: до 16 дней
  - геокодинг: поиск населённого пункта по имени

## Возможности

- Выбор геолокации: вручную поиском по названию или из браузерной геолокации
- Произвольный диапазон дат от 1 января 1940 г. до прогноза +4 дня
- Режим «этот день» — погода в выбранный день за все доступные годы
- Кэширование: запросы складываются в БД, повторно к Open-Meteo не ходим
- Тёмная/светлая тема

## Быстрый старт

### Требования

- Node.js 20+
- MySQL 8 (или совместимая MariaDB) с двумя базами:
  - основная (например `pogoda`)
  - shadow для миграций Prisma (например `pogoda_shadow`)

### Установка

```bash
git clone <repo-url>
cd pogoda
npm install
```

### Настройка окружения

```bash
cp .env.production.example .env
# открой .env и впиши свой DATABASE_URL / SHADOW_DATABASE_URL
```

Формат строки подключения:
```
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```
Если в пароле есть спецсимволы (`@ : / ? # %`) — экранируй URL-encode'ом
(`@` → `%40`, `#` → `%23` и т. д.).

### Миграции

```bash
npx prisma migrate deploy   # на чистую БД
# или
npx prisma migrate dev      # с генерацией клиента и shadow-базой
```

### Запуск в dev-режиме

```bash
npm run dev
# → http://localhost:3000
```

## Production

Проект использует Next.js standalone-сборку — на сервере нужны только
`server.js`, минимальный `node_modules` и статика. Никакого Docker.

### Сборка

```bash
npm run build
```
В `.next/standalone/` появится готовый рантайм. Для деплоя нужно ещё
доложить `public/` и `.next/static/` внутрь standalone-каталога — это
делает скрипт `build-and-deploy.sh`.

### Деплой по SSH (rsync + pm2)

Один раз создай локальный `.deploy.local` (он в `.gitignore`):

```bash
# .deploy.local
export DEPLOY_HOST=user@your-server
export DEPLOY_PATH=/home/user/pogoda
export PM2_APP=pogoda
```

Дальше деплой одним нажатием:

```bash
npm run deploy
# или
./build-and-deploy.sh
```

Без `.deploy.local` те же переменные можно передать одноразово:

```bash
DEPLOY_HOST=user@your-server DEPLOY_PATH=/home/user/pogoda ./build-and-deploy.sh
```

На сервере должны быть Node.js и [pm2](https://pm2.keymetrics.io/), а процесс
с именем `pogoda` запущен один раз вручную:

```bash
PORT=3109 HOSTNAME=127.0.0.1 NODE_ENV=production \
  pm2 start server.js --name pogoda
pm2 save
```

`.env.production` с боевым `DATABASE_URL` лежит на сервере рядом с
`server.js` — Next.js подхватит его автоматически в production-режиме.

### nginx

Пример конфига reverse-proxy: [`deploy/nginx/pogoda.example.com.conf`](deploy/nginx/pogoda.example.com.conf).
Замени `pogoda.example.com` на свой домен и подставь пути к сертификатам.

## Структура

```
app/                    — App Router: страницы и API-ручки
  api/search/           — геокодинг (поиск города)
  api/smoke-test/       — health-check
  components/           — UI-компоненты (LocationPicker, DateRangePicker, …)
  this-day/             — режим «этот день за все годы»
lib/
  openmeteo.js          — клиент Open-Meteo (geocoding / archive / forecast)
  weather-service.js    — кэширующий слой поверх БД
  weather-codes.js      — WMO weather code → человеческое описание
  prisma.js             — singleton PrismaClient
prisma/
  schema.prisma         — модели Location и HourlyWeather
  migrations/           — миграции
deploy/
  nginx/                — пример nginx-конфига
build-and-deploy.sh     — сборка standalone + rsync + pm2 restart
```

## Лицензия

MIT
