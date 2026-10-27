# Optional build secret `extra_ca`: a PEM bundle for networks with a TLS-inspecting proxy
# (common on corporate networks). Without it, builds use the image's default trust store.
ARG BASE_REGISTRY=public.ecr.aws/docker/library

# ---- build an OTP release ----
FROM ${BASE_REGISTRY}/elixir:1.18-otp-27-slim AS build
ENV MIX_ENV=prod
WORKDIR /app
# The slim image ships no CA bundle; without it Mix cannot verify hex.pm over HTTPS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY mix.exs mix.lock ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export HEX_CACERTS_PATH=/run/secrets/extra_ca SSL_CERT_FILE=/run/secrets/extra_ca; fi; \
    mix local.hex --force && mix local.rebar --force && mix deps.get --only prod && mix deps.compile
COPY config config
COPY lib lib
RUN mix compile --warnings-as-errors && mix release

# ---- runtime: same Debian release as the build image, so ERTS links correctly ----
FROM ${BASE_REGISTRY}/debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 ca-certificates locales \
 && sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --create-home chat
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 PHX_SERVER=true
WORKDIR /app
COPY --from=build --chown=10001:10001 /app/_build/prod/rel/beef_chat ./
USER 10001
EXPOSE 4000
CMD ["/app/bin/beef_chat", "start"]
