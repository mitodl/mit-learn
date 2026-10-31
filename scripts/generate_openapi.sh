#!/usr/bin/env bash
set -eo pipefail

if [ -z "$(which docker)" ]; then
	echo "Error: Docker must be available in order to run this script"
	exit 1
fi

##################################################
# Generate OpenAPI Schema
##################################################
# OPENAPI_SKIP_SPEC=1 regenerates only the client, from openapi/specs/.
# OPENAPI_K3D=1 runs the spec step in the local-dev k3d cluster instead of compose.
if [ -n "${OPENAPI_SKIP_SPEC}" ]; then
	echo "Skipping spec generation; using the specs in openapi/specs/."
elif [ -n "${OPENAPI_K3D}" ]; then
	# Tilt syncs the primary checkout into the pod, so from a linked worktree the
	# specs would describe the primary checkout's code.
	if [ "$(git rev-parse --absolute-git-dir)" != "$(cd "$(git rev-parse --git-common-dir)" && pwd -P)" ]; then
		echo "Error: the webapp pod's /src mirrors the primary checkout, not this worktree." >&2
		echo "Use OPENAPI_SKIP_SPEC=1 to regenerate only the client." >&2
		exit 1
	fi
	# stdout carries the tar stream, so the command's own output goes to stderr.
	kubectl --context local-dev -n mit-learn exec deploy/mitlearn-webapp -c app -- sh -c '
		d="$(mktemp -d)" && ./manage.py generate_openapi_spec --directory "${d}/" >&2 && tar cf - -C "${d}" .
	' | tar xf - -C openapi/specs
else
	docker compose run --no-deps --rm web \
		./manage.py generate_openapi_spec
fi

##################################################
# Generate API Client
##################################################

GENERATOR_VERSION=v7.25.0

docker run --rm -v "${PWD}:/local" -w /local openapitools/openapi-generator-cli:${GENERATOR_VERSION} \
	generate -c scripts/openapi-configs/typescript-axios-v0.yaml
docker run --rm -v "${PWD}:/local" -w /local openapitools/openapi-generator-cli:${GENERATOR_VERSION} \
	generate -c scripts/openapi-configs/typescript-axios-v1.yaml

# We expect prek to exit with a non-zero status since it is reformatting
# the generated code. That `||` also hides prek failing to start, so run it
# from its own dependency group: a plain `uv run` syncs the full dev
# environment, whose psycopg[c] cannot build without pg_config on the host.
git ls-files frontends/api/src/generated | xargs uv run --only-group prek prek run --files ||
	echo "OpenAPI generation complete."
