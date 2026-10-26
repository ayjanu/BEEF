# Shared image recipe for the Node services (core-api, game-engine).
# Build from the repo root:  docker build -f deploy/docker/node-service.Dockerfile --build-arg SERVICE=core-api .
# Optional build secret `extra_ca`: a PEM bundle for networks with a TLS-inspecting proxy
# (common on corporate networks). Without it, builds use the image's default trust store.
ARG BASE_REGISTRY=public.ecr.aws/docker/library

# ---- build: compile shared packages and the service ----
FROM ${BASE_REGISTRY}/node:22-bookworm-slim AS build
ARG SERVICE
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/game-rules/package.json packages/game-rules/
COPY services/core-api/package.json services/core-api/
COPY services/game-engine/package.json services/game-engine/
COPY tests/e2e/package.json tests/e2e/
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export npm_config_cafile=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund
COPY packages packages
COPY services/${SERVICE} services/${SERVICE}
RUN npm run build -w packages/contracts -w packages/game-rules -w services/${SERVICE}

# ---- prod deps only for this one workspace ----
FROM ${BASE_REGISTRY}/node:22-bookworm-slim AS prod-deps
ARG SERVICE
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/game-rules/package.json packages/game-rules/
COPY services/core-api/package.json services/core-api/
COPY services/game-engine/package.json services/game-engine/
COPY tests/e2e/package.json tests/e2e/
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export npm_config_cafile=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund -w services/${SERVICE}

# ---- runtime ----
FROM ${BASE_REGISTRY}/node:22-bookworm-slim
ARG SERVICE
ENV NODE_ENV=production SERVICE=${SERVICE}
# Amazon RDS CA bundle, used to verify Aurora's TLS certificate (DATABASE_CA_FILE).
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /opt/rds/global-bundle.pem
RUN chmod 755 /opt/rds && chmod 644 /opt/rds/global-bundle.pem
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=build /repo/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/packages/game-rules/package.json packages/game-rules/package.json
COPY --from=build /repo/packages/game-rules/dist packages/game-rules/dist
COPY --from=build /repo/services/${SERVICE} services/${SERVICE}
USER node
CMD ["sh", "-c", "exec node services/${SERVICE}/dist/main.js"]
