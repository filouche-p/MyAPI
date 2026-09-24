# Base stage for both dev and prod
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Dev stage (runs Vite server)
FROM base AS dev
EXPOSE 80
CMD ["npm", "run", "dev"]

# Builder stage (compiles for prod)
FROM base AS builder
RUN npm run build

# Prod stage (serves with Caddy)
FROM caddy:2-alpine AS prod
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv
EXPOSE 80 443
