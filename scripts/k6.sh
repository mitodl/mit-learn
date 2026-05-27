#!/usr/bin/env bash

SCRIPTPATH="$(
	cd -- "$(dirname "$0")" >/dev/null 2>&1 || exit
	pwd -P
)"

ROOT_DIR="$(dirname $SCRIPTPATH)"

docker run --rm -ti \
	-v $ROOT_DIR/load_testing:/app \
	--add-host learn.odl.local:host-gateway \
	grafana/k6:master-with-browser \
	run "$@"
