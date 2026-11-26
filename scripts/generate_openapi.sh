#!/usr/bin/env bash
set -eo pipefail

if [ -z "$(which docker)" ]; then
	echo "Error: Docker must be available in order to run this script"
	exit 1
fi

##################################################
# Generate OpenAPI Schema
##################################################
docker compose run --no-deps --rm web \
	./manage.py generate_openapi_spec
