# syntax=docker/dockerfile:1@sha256:572cebbc2b15e6f84c077742952674889cb63cd5e9b80abdffcbe587b6f19183
# hadolint global ignore=SC2046,DL3002,DL3008,DL3025,DL3042,DL4006

FROM mitodl/ol-python-base:3.12@sha256:d39d89b2cf5e728d85d9f4d5639921be02d2c6627335f0a3fad806e47db5646e AS base
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
      libcairo2 \
      poppler-utils \
      default-jre \
      chromium \
      chromium-driver

FROM base AS deps

# Trusted certs (org PKI + local-dev mkcert root injected at deploy time).
# COPY --chmod also applies to directories it creates; make them first so
# /usr/local/share stays traversable (perl, pg_config need it).
RUN mkdir -p /usr/local/share/ca-certificates
COPY --chmod=644 certs/ /usr/local/share/ca-certificates/
RUN update-ca-certificates

# Install Python dependencies before copying the full source so that this
# layer is only invalidated when lock files change, not on every code change.
COPY --chown=mitodl:mitodl pyproject.toml uv.lock /src/

USER mitodl
WORKDIR /src
# BuildKit cache mount keeps the uv download cache across builds, making
# uv.lock-bump rebuilds reuse already-downloaded wheels.
# --no-default-groups, not --no-dev: pyproject's `default-groups = "all"` also
# selects the prek group, which --no-dev leaves in.
RUN --mount=type=cache,target=/opt/uv-cache,uid=1000,gid=1000 \
    uv sync --frozen --no-install-project --no-default-groups

# The dev dependencies, installed before any source so a source edit reuses them.
FROM deps AS deps-dev

RUN --mount=type=cache,target=/opt/uv-cache,uid=1000,gid=1000 \
    uv sync --frozen --no-install-project

FROM deps AS runtime

USER root
COPY . /src
WORKDIR /src
RUN mkdir -p /src/staticfiles

USER mitodl

EXPOSE 8061
ENV PORT=8061
CMD ["sh", "-c", "exec granian --interface asginl --reload --host 0.0.0.0 --port ${PORT:-8061} --workers ${GRANIAN_WORKERS:-3} --blocking-threads 1 main.asgi:application"]

# ─── Development target (docker compose) ─────────────────────────────────────
FROM runtime AS development

RUN --mount=type=cache,target=/opt/uv-cache,uid=1000,gid=1000 \
    uv sync --frozen --no-install-project

# ─── Local-dev target (ol-infrastructure local-dev k8s/Tilt stack) ───────────
# FROM deps-dev, not development: development installs the dev deps after the
# source, so every source edit would reinstall them. The command and PORT come
# from the k8s manifest.
FROM deps-dev AS local-dev

# Owned by mitodl because Tilt's live update writes synced files as mitodl. No
# staticfiles directory: the webapp's collectstatic init container fills
# /src/staticfiles, an emptyDir.
COPY --chown=mitodl:mitodl . /src

# ─── Production target ───────────────────────────────────────────────────────
# MUST BE THE LAST STAGE. A build without --target produces the last stage, and
# that has to be the production image, not one of the dev targets above. Add
# new stages above this one.
FROM runtime AS production
