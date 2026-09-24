FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 8080

CMD ["npm", "start"]