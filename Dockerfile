FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./

RUN npm ci

# Also install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY . .

# Build frontend
RUN cd frontend && npm run build

FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 8080

CMD ["npm", "start"]