#!/usr/bin/env bash
#
# This script runs the django app

gunicorn --bind 0.0.0.0:8001 --reload -k uvicorn.workers.UvicornWorker main.asgi:application
