#!/usr/bin/env bash
# Сборка standalone-бандла Next.js и деплой на удалённый сервер по SSH.
# Параметры — через переменные окружения:
#   DEPLOY_HOST  — SSH-цель (user@host), напр. deploy@example.com
#   DEPLOY_PATH  — путь на сервере, напр. /home/deploy/pogoda
#   PM2_APP      — имя процесса в pm2 (по умолчанию: pogoda)
#
# Пример: DEPLOY_HOST=deploy@example.com DEPLOY_PATH=/home/deploy/pogoda ./build-and-deploy.sh

set -euo pipefail

# Локальные настройки деплоя (не коммитятся, см. .gitignore)
[[ -f .deploy.local ]] && source .deploy.local

DEPLOY_HOST="${DEPLOY_HOST:?нужно задать DEPLOY_HOST=user@host (в .deploy.local или env)}"
DEPLOY_PATH="${DEPLOY_PATH:?нужно задать DEPLOY_PATH=/path/on/server (в .deploy.local или env)}"
PM2_APP="${PM2_APP:-pogoda}"

npx next build

# Standalone не копирует public/ и .next/static автоматически — кладём руками
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

rsync -avu --delete .next/standalone/ "${DEPLOY_HOST}:${DEPLOY_PATH}"
ssh "${DEPLOY_HOST}" "pm2 restart ${PM2_APP}"

echo "Success"
