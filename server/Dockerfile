FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

RUN mkdir -p uploads logs

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/index.js"]
