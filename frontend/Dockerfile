FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

ENV HOSTNAME=0.0.0.0
CMD ["node", ".next/standalone/server.js"]
