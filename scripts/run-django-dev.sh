#!/usr/bin/env bash
#
# This script runs the django app

python3 manage.py collectstatic --noinput --clear

# run initial django migrations
python3 manage.py migrate --noinput

uwsgi uwsgi.ini --honour-stdin &
UWSGI_PID=$!

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

wait $UWSGI_PID
