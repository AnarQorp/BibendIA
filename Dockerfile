# syntax=docker/dockerfile:1.7
FROM node:22.22.0-alpine3.23@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY server ./server
RUN npm run build:server

FROM node:22.22.0-alpine3.23@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS runtime-dependencies
WORKDIR /runtime/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22.22.0-alpine3.23@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS runtime-base
ARG APP_VERSION
ARG APP_COMMIT_SHA
LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$APP_COMMIT_SHA
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    APP_COMMIT_SHA=$APP_COMMIT_SHA
WORKDIR /app/server
COPY --from=runtime-dependencies --chown=node:node /runtime/server/node_modules ./node_modules
COPY --from=build --chown=node:node /build/server/dist ./dist
USER node

FROM runtime-base AS api
EXPOSE 3100
CMD ["node", "dist/src/api/main.js"]

FROM runtime-base AS worker
EXPOSE 3101
CMD ["node", "dist/src/worker/main.js"]

FROM runtime-base AS migrator
COPY --from=build --chown=node:node /build/server/migrations ./dist/migrations
COPY --from=build --chown=node:node /build/server/bootstrap ./dist/bootstrap
CMD ["node", "dist/src/persistence/migrate.js"]
