#!/usr/bin/env bash

set -eo pipefail

echo "Running django migrations"
python manage.py showmigrations --list
python manage.py migrate --noinput
RUN_DATA_MIGRATIONS=true python manage.py migrate --noinput

echo "Syncing Qdrant collections and payload indexes"
python manage.py create_qdrant_collections

# consolidate user subscriptions and remove duplicate percolate instances
python manage.py prune_subscription_queries

echo "Generating cache tables"
python manage.py createcachetable

# clear cache entries
python manage.py clear_cache
