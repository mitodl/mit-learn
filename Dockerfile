# hadolint global ignore=SC2046,DL3002,DL3008,DL3025,DL3042,DL4006

FROM python:3.12-slim AS base
LABEL maintainer "ODL DevOps <mitx-devops@mit.edu>"

# Add package files, install updated node and pip
WORKDIR /tmp

# Install packages
COPY apt.txt /tmp/apt.txt
RUN apt-get update && \
    apt-get install -y --no-install-recommends $(grep -vE "^\s*#" apt.txt | tr "\n" " ") && \
    apt-get install libpq-dev postgresql-client -y --no-install-recommends && \
    apt-get install poppler-utils -y && \
    apt-get install default-jre -y && \
    apt-get clean && \
    apt-get purge &&  \
    rm -rf /var/lib/apt/lists/*


FROM base AS system

# Add, and run as, non-root user.
RUN mkdir /src && \
    adduser --disabled-password --gecos "" mitodl && \
    mkdir /var/media && chown -R mitodl:mitodl /var/media

FROM system AS uv

## Set some python config
ENV  \
  PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1 \
  UV_PROJECT_ENVIRONMENT='/opt/venv'
ENV PATH="/opt/venv/bin:$PATH"

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install Chromium (commented out lines illustrate the syntax for getting specific chromium versions)
RUN echo "deb http://deb.debian.org/debian/ sid main" >> /etc/apt/sources.list \
  && apt-get update -qqy \
  # && apt-get -qqy install chromium=89.0.4389.82-1 \
  # && apt-get -qqy install chromium=90.0.4430.212-1 \
  # && apt-get -qqy install chromium=93.0.4577.82-1 \
  # && apt-get -qqy install chromium=97.0.4692.71-0.1 \
  # && apt-get -qqy install chromium=98.0.4758.102-1+b1 \
  && apt-get -qqy install chromium \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# install chromedriver, which will be located at /usr/bin/chromedriver
RUN apt-get update -qqy \
  && apt-get -qqy install chromium-driver \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*
COPY pyproject.toml /src
COPY uv.lock /src
RUN chown -R mitodl:mitodl /src

USER mitodl
WORKDIR /src
RUN uv sync --frozen --no-install-project

FROM uv AS code

# Add project
USER root
# copy in trusted certs
COPY --chmod=644 certs/*.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
COPY . /src
WORKDIR /src
RUN mkdir -p /src/staticfiles

FROM code AS final
USER mitodl

EXPOSE 8061
ENV PORT 8061
CMD ["sh", "-c", "exec granian --interface wsgi --host 0.0.0.0 --port 8061 --workers ${GRANIAN_WORKERS:-3} --blocking-threads ${GRANIAN_BLOCKING_THREADS:-2} main.wsgi:application"]
