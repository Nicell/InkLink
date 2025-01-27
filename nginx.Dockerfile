FROM oven/bun:1-slim AS builder
WORKDIR /app
ARG VITE_WEB_TITLE
ENV VITE_WEB_TITLE=$VITE_WEB_TITLE
COPY package.json bun.lockb ./
RUN bun install
COPY ./postcss.config.js ./postcss.config.js
COPY ./tailwind.config.js ./tailwind.config.js
COPY ./vite.config.ts ./vite.config.ts
COPY ./index.html ./index.html
COPY ./shared ./shared
COPY ./src ./src
COPY ./public ./public
RUN bun run build:ci

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
