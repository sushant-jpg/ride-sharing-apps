FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY apps/passenger-web/package.json apps/passenger-web/package.json
COPY apps/driver-web/package.json apps/driver-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN npm ci
COPY . .
FROM base AS api
ENV NODE_ENV=production
EXPOSE 4000
USER node
CMD ["node", "server/src/index.js"]
FROM base AS web-build
ARG APP_ROLE=passenger
RUN npm run build --workspace=apps/${APP_ROLE}-web && cp -r apps/${APP_ROLE}-web/dist /web-dist
FROM nginx:stable-alpine AS web
COPY scripts/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /web-dist /usr/share/nginx/html
EXPOSE 80
