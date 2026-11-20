#!/usr/bin/env bash
# Fail unless every @mitodl/*-api-axios client in yarn.lock resolves to a
# released npm version, and no tarball is tracked. A branch build
# (file:...tgz from scripts/generate-branch-client.sh), a GitHub tarball URL or
# a `next` prerelease (-dev.) is fine for review, but must not merge: the
# backend change it depends on has to be released first.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
[ -f yarn.lock ] || {
	echo "::error::No yarn.lock at the repository root."
	exit 1
}

# Released shape: CalVer X.Y.Z (2026.11.16, 2026.1119.0). The optional -N allows
# the old same-day versions (e.g. 2026.10.20-1) published before the clients
# moved to YYYY.MM0D.N.
released='^  resolution: "@mitodl/[a-z0-9-]+-api-axios@npm:[0-9]{4}\.[0-9]+\.[0-9]+(-[0-9]+)?"$'
fail=0

bad="$(grep -E '^  resolution: "@mitodl/[a-z0-9-]+-api-axios@' yarn.lock | grep -Ev "$released" || true)"
if [ -n "$bad" ]; then
	echo "::error::An API client is not pinned to a released npm version:"
	echo "$bad"
	fail=1
fi

tarballs="$(git ls-files '*.tgz')"
if [ -n "$tarballs" ]; then
	echo "::error::Tracked tarballs (remove them before merging):"
	echo "$tarballs"
	fail=1
fi

if [ "$fail" -ne 0 ]; then
	echo "Pin a released client (yarn up -E @mitodl/<client>@<version>) and delete any tarball."
else
	echo "Every API client is a released npm version, and no tarball is tracked."
fi
exit "$fail"
