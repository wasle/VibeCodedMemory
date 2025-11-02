#!/usr/bin/env sh

set -eu

BACKEND_API_URL="${BACKEND_API_URL:-http://localhost:8000}"

if [ -f /srv/app-config.js ]; then
    tmp_file="$(mktemp)"
    escaped_url=$(printf '%s' "$BACKEND_API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
    cat <<EOF > "$tmp_file"
window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__, {
  apiServerUrl: "$escaped_url",
  defaultTileColumns: 6
});
EOF
    mv "$tmp_file" /srv/app-config.js
fi

exec "$@"
