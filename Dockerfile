FROM rust:slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config=1.8.1-* \
    libssl-dev=3.0.* \
    ca-certificates=* \
    curl=* \
    unzip=* \
    git=* \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone https://github.com/planetf1/otelite.git . && \
    cargo build --release --bin otelite && \
    cp target/release/otelite /otelite

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates=* \
    libssl3=3.0.* \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /otelite /usr/local/bin/otelite

EXPOSE 4317 4318 3000

ENTRYPOINT ["otelite"]
CMD ["serve", "--addr", "0.0.0.0:3000"]
