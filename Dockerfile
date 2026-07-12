# Root-level Dockerfile for Aiven Apps (build context = repo root).
# Identical to docker/Dockerfile; kept at the root because Aiven Apps' build_path
# points at the directory containing the Dockerfile, while our build context must
# be the repo root (it copies both frontend/ and backend/).

# --- Stage 1: build the SPA ---
FROM node:20-bookworm AS webbuild
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN cd frontend && npm install
COPY frontend/ frontend/
COPY backend/ backend/
RUN cd frontend && npm run build   # outputs to /src/backend/public

# --- Stage 2: runtime (ShadowTraffic base + Node) ---
# The ShadowTraffic image already contains a JRE and /home/shadowtraffic.jar.
FROM shadowtraffic/shadowtraffic:latest

USER root
# The ShadowTraffic base image is Wolfi (Chainguard), which uses apk — not apt-get.
# Node, npm, supervisor, and openssl are all in Wolfi's repos. keytool ships with the
# base image's GraalVM at /opt/graalvm/bin (already on PATH).
RUN apk add --no-cache nodejs npm supervisor openssl bash

WORKDIR /app
COPY backend/package.json backend/package-lock.json* backend/
RUN cd backend && npm install --omit=dev
COPY backend/ backend/
COPY --from=webbuild /src/backend/public /app/backend/public

COPY docker/supervisord.conf /etc/supervisor/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/entrypoint-shadowtraffic.sh /entrypoint-shadowtraffic.sh
RUN chmod +x /entrypoint.sh /entrypoint-shadowtraffic.sh

EXPOSE 8080
# Override the base image's java entrypoint with our supervisor bootstrap.
ENTRYPOINT ["/entrypoint.sh"]
