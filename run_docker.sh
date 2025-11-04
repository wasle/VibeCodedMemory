#!/usr/bin/env bash

set -euo pipefail

BACKEND_PROTOCOLL="http://"
BACKEND_HOSTNAME="localhost"
BACKEND_PORT=8090
BACKEND_API_URL="${BACKEND_PROTOCOLL}${BACKEND_HOSTNAME}:${BACKEND_PORT}"
ADDITIONAL_CORS_ORIGINS="${BACKEND_API_URL}"
FRONTEND_PORT=8080

docker build -t vibecodedmemory-backend ./backend
docker build -t vibecodedmemory-frontend ./frontend

docker rm -f vibecodedmemory-backend-local >/dev/null 2>&1 || true
docker rm -f vibecodedmemory-frontend-local >/dev/null 2>&1 || true

docker run -d --rm --name vibecodedmemory-backend-local -p "${BACKEND_PORT}:8000" \
    -e ADDITIONAL_CORS_ORIGINS="$ADDITIONAL_CORS_ORIGINS" \
    vibecodedmemory-backend
docker run -d --rm --name vibecodedmemory-frontend-local -p $FRONTEND_PORT:80 -e BACKEND_API_URL="$BACKEND_API_URL" vibecodedmemory-frontend

echo "Frontend API target: $BACKEND_API_URL"
if [ -n "$ADDITIONAL_CORS_ORIGINS" ]; then
    echo "Additional backend CORS origins: $ADDITIONAL_CORS_ORIGINS"
fi
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Backend:  $BACKEND_API_URL"

read -p "Press enter to stop containers:"

echo "Stopping containers..."
docker stop vibecodedmemory-frontend-local >/dev/null 2>&1 || true
docker stop vibecodedmemory-backend-local >/dev/null 2>&1 || true
echo "Containers stopped."
