#!/usr/bin/env bash
#
# Install the MIT Learn ("ol-learn") Keycloak theme for local development.
#
# The theme is built from https://github.com/mitodl/ol-keycloakify and shipped
# as a provider jar inside the mitodl/keycloak image, which deployed
# environments run directly. Local development runs the upstream Keycloak image
# instead, so we lift the jar out of mitodl/keycloak and drop it into
# config/keycloak/providers/ where Keycloak picks it up.
#
# We copy the jar rather than switching the local image because mitodl/keycloak
# tracks a newer Keycloak than docker-compose pins, and Keycloak database
# migrations are one-way — starting a newer version against an existing local
# realm database cannot be undone.
#
# Usage: ./scripts/fetch_keycloak_theme.sh [image]

set -euo pipefail

IMAGE="${1:-mitodl/keycloak:latest}"
THEME_JAR_PATTERN="keycloak-theme-for-kc"
DEST_DIR="config/keycloak/providers"
DEST="${DEST_DIR}/ol-keycloak-theme.jar"

if [ ! -d "$DEST_DIR" ]; then
	echo "Error: run this from the repository root ($DEST_DIR not found)" >&2
	exit 1
fi

echo "Pulling ${IMAGE}..."
docker pull "$IMAGE"

container_id="$(docker create "$IMAGE")"
trap 'docker rm -f "$container_id" >/dev/null 2>&1 || true' EXIT

jar_path="$(
	docker run --rm --entrypoint sh "$IMAGE" -c \
		"ls /opt/keycloak/providers/ | grep '${THEME_JAR_PATTERN}' | head -1"
)"

if [ -z "$jar_path" ]; then
	echo "Error: no ${THEME_JAR_PATTERN}*.jar found in ${IMAGE}" >&2
	exit 1
fi

echo "Copying ${jar_path} -> ${DEST}"
docker cp "${container_id}:/opt/keycloak/providers/${jar_path}" "$DEST"

echo
echo "Done. Restart Keycloak to load it:"
echo "    docker compose restart keycloak"
echo
echo "The ol-local realm export already sets loginTheme/emailTheme to 'ol-learn'."
echo "If your realm predates that, set it once in Keycloak admin"
echo "(Realm settings -> Themes) or via the admin API."
