#!/usr/bin/env bash
#
# This script runs the django app

python3 manage.py collectstatic --noinput --clear

# run initial django migrations
python3 manage.py migrate --noinput

granian --interface wsgi --host 0.0.0.0 --port "${PORT:-8061}" --workers "${GRANIAN_WORKERS:-3}" --blocking-threads "${GRANIAN_BLOCKING_THREADS:-2}" --reload --reload-ignore-dirs frontends --reload-ignore-dirs staticfiles --reload-ignore-dirs .git main.wsgi:application &
GRANIAN_PID=$!
echo "Application started with PID $GRANIAN_PID"

# populate cache table
python3 manage.py createcachetable

# run ONLY data migrations
RUN_DATA_MIGRATIONS=true python3 manage.py migrate --noinput

# load required fixtures on development by default
echo "Loading fixtures!"
python3 manage.py loaddata platforms schools departments offered_by

# create initial qdrant collections
python manage.py create_qdrant_collections

# consolidate user subscriptions and remove duplicate percolate instances
python manage.py prune_subscription_queries 2>&1

wait $GRANIAN_PID
