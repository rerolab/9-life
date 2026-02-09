FROM rust:1.85-slim AS builder

WORKDIR /app

# 依存関係のキャッシュ用に先にCargo.tomlだけコピー
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src target/release/deps/nine_life*

# ソースコードをコピーしてビルド
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/nine-life-server /usr/local/bin/server

EXPOSE 3000

CMD ["server"]
