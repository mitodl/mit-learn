FROM python:3.12-slim as base
LABEL maintainer "ODL DevOps <mitx-devops@mit.edu>"

# Add package files, install updated node and pip
WORKDIR /tmp

# Install packages
COPY apt.txt /tmp/apt.txt
RUN apt-get update && \
    apt-get install -y $(grep -vE "^\s*#" apt.txt  | tr "\n" " ") && \
    apt-get install libpq-dev postgresql-client -y && \
    apt-get clean && \
    apt-get purge


FROM base AS system

# Add, and run as, non-root user.
RUN mkdir /src && \
    adduser --disabled-password --gecos "" mitodl && \
    mkdir /var/media && chown -R mitodl:mitodl /var/media

FROM system AS poetry

## Set some poetry and python config
ENV  \
  PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1 \
  PIP_DISABLE_PIP_VERSION_CHECK=on \
  POETRY_NO_INTERACTION=1 \
  POETRY_VERSION=1.8.5 \
  POETRY_VIRTUALENVS_CREATE=true \
  POETRY_CACHE_DIR='/tmp/cache/poetry' \
  POETRY_HOME='/home/mitodl/.local' \
  VIRTUAL_ENV="/opt/venv" \
  PATH="$VIRTUAL_ENV/bin:$POETRY_HOME/bin:$PATH"

# Install poetry
RUN pip install "poetry==$POETRY_VERSION"

COPY pyproject.toml /src
COPY poetry.lock /src
RUN chown -R mitodl:mitodl /src && \
    mkdir ${VIRTUAL_ENV} && chown -R mitodl:mitodl ${VIRTUAL_ENV}

## Install poetry itself, and pre-create a venv with predictable name
USER mitodl
RUN curl -sSL https://install.python-poetry.org \
  | \
  POETRY_VERSION=${POETRY_VERSION} \
  POETRY_HOME=${POETRY_HOME} \
  python3 -q
WORKDIR /src
RUN python3 -m venv $VIRTUAL_ENV
RUN poetry install && rm -rf /tmp/cache

FROM poetry as code

# Add project
USER root
# copy in trusted certs
COPY --chmod=644 certs/*.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
COPY . /src
WORKDIR /src
RUN mkdir -p /src/staticfiles

FROM code as final
USER mitodl

EXPOSE 8061
ENV PORT 8061
CMD uwsgi uwsgi.ini
