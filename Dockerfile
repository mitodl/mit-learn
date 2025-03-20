FROM python:3.12.6
LABEL maintainer "ODL DevOps <mitx-devops@mit.edu>"

# Add package files, install updated node and pip
WORKDIR /tmp

# Install packages
COPY apt.txt /tmp/apt.txt
RUN apt-get update
RUN apt-get install -y $(grep -vE "^\s*#" apt.txt  | tr "\n" " ")
RUN apt-get update && apt-get install libpq-dev postgresql-client -y

# pip
RUN curl --silent --location https://bootstrap.pypa.io/get-pip.py | python3 -

# Add, and run as, non-root user.
RUN mkdir /src
RUN adduser --disabled-password --gecos "" mitodl
RUN mkdir /var/media && chown -R mitodl:mitodl /var/media

# copy in trusted certs
COPY --chmod=644 certs/*.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

## Set some poetry config
ENV  \
  POETRY_VERSION=1.7.1 \
  POETRY_VIRTUALENVS_CREATE=true \
  POETRY_CACHE_DIR='/tmp/cache/poetry' \
  POETRY_HOME='/home/mitodl/.local' \
  VIRTUAL_ENV="/opt/venv"
ENV PATH="$VIRTUAL_ENV/bin:$POETRY_HOME/bin:$PATH"

# Install poetry
RUN pip install "poetry==$POETRY_VERSION"



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
COPY poetry.lock /src
RUN chown -R mitodl:mitodl /src
RUN mkdir ${VIRTUAL_ENV} && chown -R mitodl:mitodl ${VIRTUAL_ENV}

## Install poetry itself, and pre-create a venv with predictable name
USER mitodl
RUN curl -sSL https://install.python-poetry.org \
  | \
  POETRY_VERSION=${POETRY_VERSION} \
  POETRY_HOME=${POETRY_HOME} \
  python3 -q
WORKDIR /src
RUN python3 -m venv $VIRTUAL_ENV
RUN poetry install

# Add project
USER root
COPY . /src
WORKDIR /src
RUN mkdir -p /src/staticfiles

RUN apt-get clean && apt-get purge

USER mitodl

EXPOSE 8061
ENV PORT 8061
CMD uwsgi uwsgi.ini
