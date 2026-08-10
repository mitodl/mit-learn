import type { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"

/**
 * The Keycloak organization UUID, which is what the analytics API keys every
 * org endpoint on — it is the only identifier stable across the JWT, MITx
 * Online and StarRocks (see mitodl/ol-analytics-api#13).
 *
 * MITx Online exposes it on `OrganizationPageSerializer` as
 * `sso_organization_id` (mitodl/mitxonline#3789, released in
 * `@mitodl/mitxonline-api-axios@2026.8.6`). The generated type now declares
 * it as always present (`string | null`), but a mit-learn deploy can still
 * talk to an older MITx Online that predates that PR and simply omits the
 * field from the response — the type can't see that, so this stays a
 * defensive read rather than a direct `org.sso_organization_id` access.
 *
 * Returning `null` for that case (as well as for a genuine `null` or empty
 * string) is the load-bearing part: it must surface as "analytics
 * unavailable for this org" rather than as a request to the analytics API
 * with `undefined` in the path.
 */
const getOrgUuid = (org: OrganizationPage | undefined): string | null =>
  org?.sso_organization_id || null

export { getOrgUuid }
