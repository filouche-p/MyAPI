FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./

RUN npm ci

COPY . .

FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 8080

CMD ["node", "index.js"]