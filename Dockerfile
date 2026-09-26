# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32
# hadolint global ignore=SC2046,DL3002,DL3008,DL3025,DL3042,DL4006

FROM mitodl/ol-python-base:3.12 AS base
LABEL maintainer="ODL DevOps <mitx-devops@mit.edu>"

# App-specific apt extras; common-core packages are in mitodl/ol-python-base:3.12.
# BuildKit cache mounts keep downloaded packages out of the final image layer.
# chromium/chromium-driver come from trixie. They
# used to need a Debian sid source because trixie lagged; it no longer does,
# and pulling from sid dragged in a glibc upgrade that conflicts with the
# hardened base image.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      libcairo2-dev \
      poppler-utils \
      default-jre \
      chromium \
      chromium-driver

FROM base AS deps

# Trusted certs (org PKI + local-dev mkcert root injected at deploy time).
COPY --chmod=644 certs/ /usr/local/share/ca-certificates/
RUN update-ca-certificates

# Install Python dependencies before copying the full source so that this
# layer is only invalidated when lock files change, not on every code change.
COPY --chown=mitodl:mitodl pyproject.toml uv.lock /src/

USER mitodl
WORKDIR /src
# BuildKit cache mount keeps the uv download cache across builds, making
# uv.lock-bump rebuilds reuse already-downloaded wheels.
RUN --mount=type=cache,target=/opt/uv-cache,uid=1000,gid=1000 \
    uv sync --frozen --no-install-project --no-dev

FROM deps AS final

USER root
COPY . /src
WORKDIR /src
RUN mkdir -p /src/staticfiles

USER mitodl

EXPOSE 8061
ENV PORT=8061
CMD ["sh", "-c", "exec granian --interface asginl --reload --host 0.0.0.0 --port ${PORT:-8061} --workers ${GRANIAN_WORKERS:-3} --blocking-threads 1 main.asgi:application"]

# ─── Development target (docker compose) ─────────────────────────────────────
FROM final AS development

RUN --mount=type=cache,target=/opt/uv-cache,uid=1000,gid=1000 \
    uv sync --frozen --no-install-project

# ─── Local-dev target (ol-infrastructure local-dev k8s/Tilt stack) ───────────
# Runtime user owns /src (live-synced source); dev deps come from `development`.
FROM development AS local-dev

USER root
RUN chown -R mitodl:mitodl /src
USER mitodl
