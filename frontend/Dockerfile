FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build && \
    cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

ENV HOSTNAME=0.0.0.0
CMD ["node", ".next/standalone/server.js"]
