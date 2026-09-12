FROM rust:slim-bookworm@sha256:ebd900bae66fd508b466cef82d64a83a5fb34682e4c8b2797a42908bddc95a57 AS builder

ARG OTELITE_COMMIT=86a931a8f010309a91b6a42501c4e39cbf2eae9b

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config=1.8.1-* \
    libssl-dev=3.0.* \
    ca-certificates=* \
    curl=* \
    unzip=* \
    git=* \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone --no-tags https://github.com/planetf1/otelite.git . && \
    git checkout --detach "$OTELITE_COMMIT" && \
    cargo build --locked --release --bin otelite && \
    cp target/release/otelite /otelite

FROM debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates=* \
    libssl3=3.0.* \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 ozaki && \
    mkdir -p /home/ozaki/.local/share/otelite && \
    chown -R ozaki:ozaki /home/ozaki

COPY --from=builder --chown=ozaki:ozaki /otelite /usr/local/bin/otelite

USER ozaki

EXPOSE 4317 4318 3000

ENTRYPOINT ["otelite"]
CMD ["serve", "--addr", "0.0.0.0:3000"]
