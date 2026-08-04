import type { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"

/**
 * The Keycloak organization UUID, which is what the analytics API keys every
 * org endpoint on — it is the only identifier stable across the JWT, MITx
 * Online and StarRocks (see mitodl/ol-analytics-api#13).
 *
 * MITx Online exposes it on `OrganizationPageSerializer` as
 * `sso_organization_id` (mitodl/mitxonline#3789). That change has not been cut
 * into a release of `@mitodl/mitxonline-api-axios` yet, so the generated
 * `OrganizationPage` type does not declare the field and we have to read it
 * off the wire ourselves.
 *
 * Returning `null` when it is absent is the load-bearing part: it is exactly
 * what happens when mit-learn is pointed at a MITx Online deploy that predates
 * that PR, and it must surface as "analytics unavailable for this org" rather
 * than as a request to the analytics API with `undefined` in the path.
 *
 * TODO: delete this and read `org.sso_organization_id` directly once the
 * regenerated client is picked up in `frontends/api/package.json`.
 */
const getOrgUuid = (org: OrganizationPage | undefined): string | null => {
  const value = (org as { sso_organization_id?: unknown } | undefined)
    ?.sso_organization_id
  return typeof value === "string" && value.length > 0 ? value : null
}

export { getOrgUuid }
