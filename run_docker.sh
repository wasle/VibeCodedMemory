#!/usr/bin/env bash

set -euo pipefail

BACKEND_API_URL="${BACKEND_API_URL:-http://localhost:8000}"
ADDITIONAL_CORS_ORIGINS="${ADDITIONAL_CORS_ORIGINS:-}"

docker build -t vibecodedmemory-backend ./backend
docker build -t vibecodedmemory-frontend ./frontend

docker rm -f vibecodedmemory-backend-local >/dev/null 2>&1 || true
docker rm -f vibecodedmemory-frontend-local >/dev/null 2>&1 || true

docker run -d --rm --name vibecodedmemory-backend-local -p 8000:8000 \
    -e ADDITIONAL_CORS_ORIGINS="$ADDITIONAL_CORS_ORIGINS" \
    vibecodedmemory-backend
docker run -d --rm --name vibecodedmemory-frontend-local -p 8080:80 -e BACKEND_API_URL="$BACKEND_API_URL" vibecodedmemory-frontend

echo "Frontend API target: $BACKEND_API_URL"
if [ -n "$ADDITIONAL_CORS_ORIGINS" ]; then
    echo "Additional backend CORS origins: $ADDITIONAL_CORS_ORIGINS"
fi
echo "Frontend: http://localhost:8080"
echo "Backend:  http://localhost:8000"
