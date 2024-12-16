#!/usr/bin/env bash
#
# This script runs the django app

gunicorn main.asgi:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers 4 --threads 2
