#!/usr/bin/env bash
# Build @mitodl/mit-learn-api-axios from this checkout's committed OpenAPI spec
# and write it as mit-learn-api-axios-<sha>.tgz, for a frontend branch to
# commit and depend on before the backend change is released.
#
# Usage: scripts/generate-branch-client.sh [output-dir]   (default: frontends/api)
#
# Needs git and docker only. Generator configs, the generator version and the
# package skeleton come from mitodl/mit-learn-api-clients main, the inputs the
# publish pipeline uses. Nothing is pushed or published.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
OUT_DIR="$(cd "${1:-$REPO_ROOT/frontends/api}" && pwd)"
CLIENTS_REPO="${MITOL_API_CLIENTS_REPO:-https://github.com/mitodl/mit-learn-api-clients.git}"

# The file name names the commit the spec came from, so refuse to build while
# the spec differs from that commit.
if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- openapi/specs)" ]; then
	echo "openapi/specs has uncommitted changes. Commit them first: the tarball is named after HEAD." >&2
	exit 1
fi
SHA="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)"
TGZ="mit-learn-api-axios-$SHA.tgz"

# Under $HOME, not $TMPDIR: every Docker runtime shares $HOME with containers,
# but some (Colima) don't share macOS's /var/folders.
WORK="$(mktemp -d "$HOME/.mit-learn-branch-client.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
git clone --quiet --depth 1 "$CLIENTS_REPO" "$WORK/mit-learn-api-clients"
# The configs read mit-learn/openapi/specs/*.yaml relative to the working dir.
mkdir -p "$WORK/mit-learn"
git -C "$REPO_ROOT" archive HEAD openapi/specs | tar -x -C "$WORK/mit-learn"
GENERATOR_VERSION="$(tr -d '[:space:]' <"$WORK/mit-learn-api-clients/OPENAPI-GENERATOR-VERSION")"

for config in "$WORK"/mit-learn-api-clients/config/*.yaml; do
	docker run --rm --user "$(id -u):$(id -g)" -v "$WORK:/local" -w /local \
		"openapitools/openapi-generator-cli:$GENERATOR_VERSION" \
		generate -c "mit-learn-api-clients/config/$(basename "$config")"
done

# Build and pack in the image the publish pipeline uses. The version marks the
# tarball as a branch build so it can never pass for a published one.
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
	-v "$WORK/mit-learn-api-clients/src/typescript/mit-learn-api-axios:/pkg" -v "$OUT_DIR:/out" -w /pkg \
	node:24-slim bash -euc "
		corepack yarn install --immutable
		npm pkg set version=0.0.0-branch.g$SHA
		corepack yarn build
		corepack yarn pack --out /out/$TGZ"

# A root `resolutions` entry, not a file: dependency in frontends/api, so one
# path serves every workspace that depends on the client: a file: path in a
# workspace's package.json resolves from that workspace, in root resolutions
# from the repository root.
case "$OUT_DIR" in
"$REPO_ROOT") TGZ_PATH="./$TGZ" ;;
"$REPO_ROOT"/*) TGZ_PATH="./${OUT_DIR#"$REPO_ROOT"/}/$TGZ" ;;
*) TGZ_PATH="$OUT_DIR/$TGZ" ;;
esac

echo
echo "Wrote $OUT_DIR/$TGZ (spec from $SHA)."
echo
echo "Branch client now installable via (from the repository root)"
echo
echo "  npm pkg set 'resolutions.@mitodl/mit-learn-api-axios=file:$TGZ_PATH'"
echo "  yarn install"
echo
echo "Commit the tarball, package.json and yarn.lock. CI's api-clients-released check stays"
echo "red until the tarball and the resolution are removed and a released version is pinned."
