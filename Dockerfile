FROM oven/bun:1-slim AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY ./shared ./shared
COPY ./server ./server
RUN bun build --compile --minify --sourcemap --bytecode server/index.ts --outfile ./app

FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY --from=builder /app/app /app/app
ENTRYPOINT [ "./app" ]
