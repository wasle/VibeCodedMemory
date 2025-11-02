# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine AS runtime

WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/memory-game/browser ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R 65532:65532 /srv

EXPOSE 80

USER 65532

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
