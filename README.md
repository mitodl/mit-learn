# MIT Learn

![CI Workflow](https://github.com/mitodl/mit-learn/actions/workflows/ci.yml/badge.svg)

This application provides a central interface from which learners can browse MIT courses.

**SECTIONS**

1. [Initial Setup](#initial-setup)
1. [Code Generation](#code-generation)
1. [Committing & Formatting](#committing-&-formatting)
1. [Optional Setup](#optional-setup)

## Initial Setup

MIT Learn follows the same [initial setup steps outlined in the common OL web app guide](https://mitodl.github.io/handbook/how-to/common-web-app-guide.html).
Run through those steps **including the addition of `/etc/hosts` aliases and the optional step for running the
`createsuperuser` command**.

For `/etc/hosts`, you'll need to add entries for the following domains if you are relying on the sample environment variables:

```
api.open.odl.local
open.odl.local
kc.ol.local
```

### Configuration

Configuration can be put in the following files which are gitignored:

```
mit-learn/
  ├── env/
  │   ├── shared.local.env (provided to both frontend and backend containers)
  │   ├── frontend.local.env (provided only to frontend containers)
  │   └── backend.local.env (provided only to backend containers)
  └── .env (legacy file)
```

The following settings must be configured before running the app:

- `COMPOSE_PROFILES`

  Controls which docker containers run. To run them all, use `COMPOSE_PROFILES=backend,frontend,keycloak,apisix`. See [Frontend Development](./frontends/README.md) for more.
  This can be set either in a top-level `.env` that `docker compose` [automatically ingests](https://docs.docker.com/compose/environment-variables/envvars/#compose_env_files) or through any other method of setting an environment variable in your shell (e.g. `direnv`).

- `MAILGUN_KEY` and `MAILGUN_SENDER_DOMAIN`

  You can set these values to any non-empty string value if email-sending functionality
  is not needed. It's recommended that you eventually configure the site to be able
  to send emails. Those configuration steps can be found [below](#enabling-email).

Before proceeding with any additional setup, you may want to adjust your docker settings to allow more memory to be used by the containers. Many engineers allocate the bulk of their system resources by navigating to Settings -> Resources in Docker Desktop.
Additionally, the `web` and `celery` services specify `memory_limit` values, which you can adjust using the following environment variables:

```
MITOL_CELERY_MEM_LIMIT
MITOL_WEB_MEM_LIMIT
```

If any resource limits are set too low, you may encounter OOMKilled errors in the logs of those services. The primary way this will manifest is that containers may unexpectedly die during operation resulting in 500 errors or unusual celery task execution.
Given a container that is unexpectedly down, you can verify that it was OOMKilled by running `docker inspect <container_name> -f '{{json .State.OOMKilled}}'`, or by checking the Docker VM kernel message logs for relevant output.

By default, many scheduled celery tasks run on a frequent basis, daily or even multiple times per day. This could potentially slow down development and testing. You can disable all scheduled celery tasks by adding `CELERY_BEAT_DISABLED=True` to your `backend.local.env` file.

### Loading Data

The MIT Learn platform aggregates data from many sources. These data are populated by ETL (extract, transform, load) pipelines that run automatically on a regular schedule. Django [management commands](https://docs.djangoproject.com/en/4.2/howto/custom-management-commands/) are also available to force the pipelines to run—particularly useful for local development.

To load data from [xpro](https://github.com/mitodl/mitxpro), for example, ensure you have the relevant environment variables

```
XPRO_CATALOG_API_URL
XPRO_COURSES_API_URL
```

and run

```bash
docker compose run --rm web python manage.py backpopulate_xpro_data
```

See [learning_resources/management/commands](learning_resources/management/commands) and [main/settings_course_etl.py](main/settings_course_etl.py) for more ETL commands and their relevant environment variables.

You may also want to generate embeddings once you have populated some data in so vector search and recommendations function as expected. See [docs/how-to/embeddings.md](docs/how-to/embeddings.md) for more details on this process.

### Frontend Development

The frontend package root is at [./frontends](./frontends). A `watch` container is provided to serve and rebuild the front end when there are changes to source files, which is started alongside backing services with `docker compose up`.

Package scripts are also provided for building and serving the frontend in isolation. More detail can be found in the [Frontend README](./frontends/README.md#frontend-development).

### Connecting with Keycloak for authentication

While not technically required to get the app running, it is the preferred way to work on features which require authentication.

Please read [the Keycloak README](README-keycloak.md) for instructions on authenticating via
local Keycloak and APISIX containers.

## Code Generation

MIT Learn uses [drf-spectacular](https://drf-spectacular.readthedocs.io/en/latest/) to generate and OpenAPI spec from Django views. Additionally, we use [OpenAPITools/openapi-generator](https://github.com/OpenAPITools/openapi-generator) to generate Typescript declarations and an API Client. These generated files are checked into source control; CI checks that they are up-to-date. To regenerate these files, run

```bash
./scripts/generate_openapi.sh
```

## Committing & Formatting

To ensure commits to GitHub are safe, first install [pre-commit](https://pre-commit.com/):

```
pip install pre_commit
pre-commit install
```

Running pre-commit can confirm your commit is safe to be pushed to GitHub and correctly formatted:

```
pre-commit run --all-files
```

To automatically install precommit hooks when cloning a repo, you can run this:

```
git config --global init.templateDir ~/.git-template
pre-commit init-templatedir ~/.git-template
```

## Launching a Codespace

There are times where you will want a live and shareable environment (validating UI changes with the design team, demoing a feature etc). You can launch a codespace on any branch or PR by clicking the green "code" button at the top right and launching a codespace from the codespaces tab. There are a few things to be aware of when provisioning a codespace:

- DEBUG is disabled by default - this is because codespaces are live (but unpublished/indexed) environments.
- Codespaces are provisioned/billed under personal accounts - everyone has 120 free hours every month
- Secrets and environment variables can be configured in the [codespace settings page](https://github.com/settings/codespaces)
- You will have to manually set the api's port to public each time you launch a codespace (noted in instructions above) due to a known limitation with cors in codespaces (see: https://github.com/orgs/community/discussions/22399 and https://github.com/orgs/community/discussions/31316)
- Once you are finished with the codespace you should shut it down by going to the green code button -> codespaces tab
- limits, instance size, idle-timeout settings and more can be configured from the [codespace settings page](https://github.com/settings/codespaces)

When new environment variables are introduced to the main application, the codespace config should be updated as well:

- Environment variables that are required for the app to build/function belong in [codespaces.env](https://github.com/mitodl/mit-open/blob/main/env/codespaces.env) with some default value (developers can later override these as needed)
- Optional "suggested" variables should go in [devcontainer.json](https://github.com/mitodl/mit-open/blob/main/.devcontainer/devcontainer.json)

At a bare minimum, a codespace should be able to build and run without requiring any configuration

## Optional Setup

Described below are some setup steps that are not strictly necessary
for running MIT Learn

### Enabling email

The app is usable without email-sending capability, but there is a lot of app functionality
that depends on it. The following variables will need to be set in your `.env` file -
please reach out to a fellow developer or devops for the correct values.

```
MAILGUN_SENDER_DOMAIN
MAILGUN_URL
MAILGUN_KEY
```

Additionally, you'll need to set `MAILGUN_RECIPIENT_OVERRIDE` to your own email address so
any emails sent from the app will be delivered to you.

### Loading fixture files

Run the following to load platforms, departments, and offers. This populates the database with the fixture files contained in [learning_resources/fixtures](learning_resources/fixtures). Note that you will first need to run the Django models to schema migrations detailed in the [Handbook Initial Setup](https://mitodl.github.io/handbook/how-to/common-web-app-guide.html#3-create-database-tables-from-the-django-models) step.

```bash
# Note!
# This is already done for you when bringing up your local (development)
# environment.
docker compose run --rm web python manage.py loaddata platforms departments offered_by
```

### Enabling image uploads to S3

:warning: **NOTE: Article cover image thumbnails will be broken unless this is configured** :warning:

Article posts give users the option to upload a cover image, and we show a thumbnail for that
image in post listings. We use Embedly to generate that thumbnail, so they will appear as
broken images unless you configure your app to upload to S3. Steps:

1. Set `MITOL_USE_S3=True` in `.env`
1. Also in `.env`, set these AWS variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `AWS_STORAGE_BUCKET_NAME`

   These values can be copied directly from the Open Discussions CI Heroku settings, or a
   fellow dev can provide them.

### Enabling searching the course catalog on opensearch

To enable searching the course catalog on opensearch, run through these steps:

1. Start the services with `docker compose up`
2. With the above running, run this management command, which kicks off a celery task, to create an opensearch index:
   ```
   docker compose  run web python manage.py recreate_index --all
   ```
   If there is an error running the above command, observe what traceback gets logged in the celery service.
3. Once created and with `docker compose up` running, hit this endpoint in your browser to see if the index exists: `http://localhost:9101/discussions_local_all_default/_search`
4. If yes, to run a specific query, make a `POST` request (using `curl`, [Postman](https://www.getpostman.com/downloads/), Python `requests`, etc.) to the above endpoint with a `json` payload. For example, to search for all courses, run a query with Content-Type as `application/json` and with a body `{"query":{"term":{"object_type":"course"}}}`

### Running OpenSearch as a multi-node local cluster

By default the configuration runs OpenSearch in `single-node` mode. If you'd like to run a 3-node cluster locally you can set the following environment variable in your shell.

```shell
export OPENSEARCH_CLUSTER_TYPE=cluster
```

You should make this permanent by using `direnv` or similar so that all your shell sessions are using the same docker compose config):

After setting this and running `docker compose up` you'll see this 3 node cluster be created. Note that the volumes used by these containers are separate from the volume used by the single-node setup so you will need to recreate your indicies. This is intentional and critical to being able to switch back and forth between `single-node` and `cluster` setups.

### Running the app in a notebook

This repo includes a config for running a [Jupyter notebook](https://jupyter.org/) in a Docker container. This enables you to do in a Jupyter notebook anything you might otherwise do in a Django shell. To get started:

- Copy the example file
  ```bash
  # Choose any name for the resulting .ipynb file
  cp app.ipynb.example app.ipynb
  ```
- Build the `notebook` container _(for first time use, or when requirements change)_
  ```bash
  docker compose -f docker-compose-notebook.yml build
  ```
- Run all the standard containers (`docker compose up`)
- In another terminal window, run the `notebook` container
  ```bash
  docker compose -f docker-compose-notebook.yml run --rm --service-ports notebook
  ```
- The notebook container log output will indicate a URL at which you can interact with the notebook server.
- After visiting the notebook url, click the `.ipynb` file that you created to run the notebook
- Execute the first block to confirm it's working properly (click inside the block and press Shift+Enter)

From there, you should be able to run code snippets with a live Django app just like you would in a Django shell.

### Configuring PostHog Support

The system can use PostHog to evaluate feature flags and record views for the Learning Resource drawer.

The following environment variables must be set for this support to work:

- `POSTHOG_PROJECT_ID` - int, the project ID for the app in PostHog
- `POSTHOG_PROJECT_API_KEY` - string, the project API key for the app in PostHog. This usually starts with `phc_`.
- `POSTHOG_PERSONAL_API_KEY` - string, your personal API key for PostHog. This usually starts with `phx_`.

The keys and ID can be found in the Settings section of the project in PostHog that you're using for the app. The project key and ID are under "Project", and you can generate a personal API key under "User"->"Personal API Keys".

> [!WARNING]
> Be careful with the API keys! The project API key is **not secret** and is sent in clear text with the frontend. The personal API key **is** secret. Don't mix them up.

Personal API keys only need read permission to Query. When creating a personal API key, choose "Read" under Query for Scopes. The key needs no other permissions (unless you need them for other things). Additionally, if you select either option besides "All-access" under "Organization & project access", make sure you assign the correct project/org to the API key.

Once these are set (and you've restarted the app), you should see events flowing into the PostHog dashboard.

### Connecting with MITxOnline

Both MITxOnline and MIT Learn repos have keycloak and apisix containers included in their stacks. In connecting the two projects, we want to use the same Keycloak+Apisix container for both projects. Here we assume that the Learn Keycloak+Apisix will be used. There are some caveats to this setup:

> [!TIP]
> You cannot login from the MITxOnline frontend; Logging in via the Learn frontend will authenticate you with the MITxOnline backend.

Set up the [mitxonline](https://github.com/mitodl/mitxonline) as indicated there, **using the environment variables below**. ( _Note: A working OpenEdx installation is not necessary for integration with Learn._)

```env
# MITxOnline, .env
CSRF_COOKIE_DOMAIN=.odl.local
CORS_ALLOWED_ORIGINS=http://mitxonline.odl.local:8065, http://open.odl.local:8062
CSRF_TRUSTED_ORIGINS=http://mitxonline.odl.local:8065, http://open.odl.local:8062

# For mitol-django-apigateway
MITOL_APIGATEWAY_DISABLE_MIDDLEWARE=False
MITOL_APIGATEWAY_USERINFO_CREATE=True
MITOL_APIGATEWAY_USERINFO_UPDATE=True

# Keycloak settings, these should match mit-learn
KEYCLOAK_BASE_URL=http://kc.ol.local:8066
KEYCLOAK_CLIENT_ID=apisix
KEYCLOAK_CLIENT_SECRET=HckCZXToXfaetbBx0Fo3xbjnC468oMi4 # pragma: allowlist-secret
KEYCLOAK_DISCOVERY_URL=http://kc.ol.local:8066/realms/ol-local/.well-known/openid-configuration
KEYCLOAK_REALM_NAME=ol-local
```

Then, in Learn, set these values:

```env
# MIT Learn, shared.local.env (ensure not overwritten in backend/frontend env)
MITX_ONLINE_BASE_URL=http://api.open.odl.local:8065/mitxonline

# MIT Learn, backend.local.env
MITX_ONLINE_COURSES_API_URL=http://mitxonline.odl.local:8013/api/v2/courses/
MITX_ONLINE_PROGRAMS_API_URL=http://mitxonline.odl.local:8013/api/v2/programs/
```

## GitHub Pages Storybook

Demos and documentation of reusable UI components in this repo are published as a [storybook](https://storybook.js.org/) at https://mitodl.github.io/mit-learn/.
