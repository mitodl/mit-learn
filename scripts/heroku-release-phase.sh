#!/usr/bin/env bash

set -eo pipefail
indent() {
	RE="s/^/       /"
	[ "$(uname)" == "Darwin" ] && sed -l "$RE" || sed -u "$RE"
}

MANAGE_FILE=$(find . -maxdepth 3 -type f -name 'manage.py' | head -1)
# trim "./" from the path
MANAGE_FILE=${MANAGE_FILE:2}
#
# Run migrations

echo "-----> Running django migrations"
python $MANAGE_FILE showmigrations --list 2>&1 | indent
python $MANAGE_FILE migrate --noinput 2>&1 | indent
RUN_DATA_MIGRATIONS=true python $MANAGE_FILE migrate --noinput 2>&1 | indent

# consolidate user subscriptions and remove duplicate percolate instances
python $MANAGE_FILE prune_subscription_queries 2>&1 | indent

echo "-----> Generating cache tables"
python $MANAGE_FILE createcachetable 2>&1 | indent

# clear cache entries
python $MANAGE_FILE clear_cache 2>&1 | indent
