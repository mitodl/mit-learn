#!/usr/bin/env bash
set -eo pipefail

GENERATOR_VERSION="${GENERATOR_VERSION:-v7.2.0}"
RUNNER="${OPENAPI_RUNNER:-auto}"
SKIP_SPEC="${OPENAPI_SKIP_SPEC:-}"
K8S_CONTEXT="${OPENAPI_K8S_CONTEXT:-local-dev}"
K8S_NAMESPACE="${OPENAPI_K8S_NAMESPACE:-mit-learn}"
K8S_DEPLOYMENT="${OPENAPI_K8S_DEPLOYMENT:-deploy/mitlearn-webapp}"

# Every kubectl call names its context rather than inheriting whichever one
# `kubectl config use-context` last selected. The spec step execs into a pod and
# copies that pod's output over openapi/specs/, so an ambient context pointing at
# a deployed cluster would silently produce specs describing that cluster's code.
# ol-infrastructure/local-dev/scripts/setup.sh renames k3d's generated
# k3d-<cluster> context to this name, and its start.sh requires it.
kube() {
	kubectl --context "${K8S_CONTEXT}" -n "${K8S_NAMESPACE}" "$@"
}

usage() {
	cat <<'USAGE'
Usage: scripts/generate_openapi.sh [options]

  --runner auto|compose|k3d   Where to run ./manage.py generate_openapi_spec.
                              "auto" picks k3d when the webapp deployment is
                              reachable in the kubectl context named below,
                              and compose otherwise.
  --context NAME              kubectl context for the k3d runner. Defaults to
                              local-dev, the context ol-infrastructure's
                              local-dev/scripts/setup.sh creates.
  --skip-spec                 Regenerate only the TypeScript client, from the
                              specs already in openapi/specs/.
  --generator-version TAG     openapi-generator-cli image tag.

Each option has an environment equivalent: OPENAPI_RUNNER, OPENAPI_K8S_CONTEXT,
OPENAPI_SKIP_SPEC, GENERATOR_VERSION, OPENAPI_K8S_NAMESPACE,
OPENAPI_K8S_DEPLOYMENT.
USAGE
}

while [ $# -gt 0 ]; do
	case "$1" in
	--runner)
		RUNNER="$2"
		shift 2
		;;
	--runner=*)
		RUNNER="${1#*=}"
		shift
		;;
	--context)
		K8S_CONTEXT="$2"
		shift 2
		;;
	--context=*)
		K8S_CONTEXT="${1#*=}"
		shift
		;;
	--skip-spec)
		SKIP_SPEC=1
		shift
		;;
	--generator-version)
		GENERATOR_VERSION="$2"
		shift 2
		;;
	--generator-version=*)
		GENERATOR_VERSION="${1#*=}"
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Error: unknown argument '$1'" >&2
		usage >&2
		exit 1
		;;
	esac
done

# The client step always needs docker. So does the compose runner, and k3d itself
# runs on docker, so this is a precondition either way.
if [ -z "$(which docker)" ]; then
	echo "Error: Docker must be available in order to run this script"
	exit 1
fi

if [ -z "${SKIP_SPEC}" ] && [ "${RUNNER}" = "auto" ]; then
	# A missing context fails this too: kubectl rejects --context values it cannot
	# resolve, so an unconfigured or differently-named cluster falls back to
	# compose rather than reaching for whatever is currently selected.
	if command -v kubectl >/dev/null 2>&1 &&
		kube get "${K8S_DEPLOYMENT}" >/dev/null 2>&1; then
		RUNNER=k3d
	else
		RUNNER=compose
	fi
fi

if [ -z "${SKIP_SPEC}" ] && [ "${RUNNER}" = "k3d" ]; then
	if ! kubectl config get-contexts "${K8S_CONTEXT}" >/dev/null 2>&1; then
		echo "Error: kubectl context '${K8S_CONTEXT}' not found." >&2
		echo "Run ol-infrastructure/local-dev/scripts/setup.sh to create it," >&2
		echo "or name a different one with --context." >&2
		exit 1
	fi

	# Tilt live-syncs the primary checkout into the webapp pod, so the pod's /src
	# is that tree even when this script is invoked from a linked worktree. Left
	# unchecked, the specs would describe the primary checkout's code and get
	# written over this tree's.
	primary="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
	if [ "$(git rev-parse --absolute-git-dir)" != "${primary}" ]; then
		echo "Error: --runner k3d cannot be used from a linked git worktree." >&2
		echo "The webapp pod's /src mirrors ${primary%/.git}, not this tree." >&2
		echo "Use --skip-spec to regenerate only the client from openapi/specs/," >&2
		echo "or run the spec step from the primary checkout." >&2
		exit 1
	fi
fi

##################################################
# Generate OpenAPI Schema
##################################################
if [ -n "${SKIP_SPEC}" ]; then
	echo "Skipping spec generation; using the specs in openapi/specs/."
elif [ "${RUNNER}" = "compose" ]; then
	echo "Generating OpenAPI specs with the compose runner..."
	docker compose run --no-deps --rm web \
		./manage.py generate_openapi_spec
elif [ "${RUNNER}" = "k3d" ]; then
	echo "Generating OpenAPI specs with the k3d runner:"
	echo "  context ${K8S_CONTEXT}, namespace ${K8S_NAMESPACE}, ${K8S_DEPLOYMENT}"
	# Nothing written inside the pod reaches the checkout, so generate into a
	# scratch directory and stream it back.
	kube exec "${K8S_DEPLOYMENT}" -c app -- \
		sh -c 'rm -rf /tmp/openapi-specs && mkdir -p /tmp/openapi-specs'
	kube exec "${K8S_DEPLOYMENT}" -c app -- \
		./manage.py generate_openapi_spec --directory /tmp/openapi-specs/
	kube exec "${K8S_DEPLOYMENT}" -c app -- \
		tar cf - -C /tmp/openapi-specs . | tar xf - -C openapi/specs
else
	echo "Error: unknown runner '${RUNNER}' (expected auto, compose, or k3d)" >&2
	exit 1
fi

##################################################
# Generate API Client
##################################################

docker run --rm -v "${PWD}:/local" -w /local openapitools/openapi-generator-cli:${GENERATOR_VERSION} \
	generate -c scripts/openapi-configs/typescript-axios-v0.yaml
docker run --rm -v "${PWD}:/local" -w /local openapitools/openapi-generator-cli:${GENERATOR_VERSION} \
	generate -c scripts/openapi-configs/typescript-axios-v1.yaml

# We expect pre-commit to exit with a non-zero status since it is reformatting
# the generated code.
git ls-files frontends/api/src/generated | xargs pre-commit run --files ||
	echo "OpenAPI generation complete."
