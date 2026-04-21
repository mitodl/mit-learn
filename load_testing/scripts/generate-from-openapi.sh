#!/usr/bin/env bash

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PARENT_DIR=$(dirname "${SCRIPT_DIR}")
ROOT_DIR=$(dirname "${PARENT_DIR}")

pushd $PARENT_DIR || exit 1

npx openapi-to-k6 --mode split "${ROOT_DIR}/openapi/specs/v0.yaml" "${ROOT_DIR}/load_testing/backend/client/v0/api.ts"
npx openapi-to-k6 --mode split "${ROOT_DIR}/openapi/specs/v1.yaml" "${ROOT_DIR}/load_testing/backend/client/v1/api.ts"

popd || exit 1
