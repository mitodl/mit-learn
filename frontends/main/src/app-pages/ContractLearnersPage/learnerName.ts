import { parseStringifiedScimName } from "ol-utilities"

/**
 * Display-layer workaround for corrupted `full_name` values.
 *
 * Some learners arrive from `ol-analytics-api` with a `full_name` holding the
 * Python `repr()` of a SCIM `name` object rather than a name:
 *
 *     {'givenName': 'Anna', 'familyName': 'Gavrilman'}
 *
 * Root cause is in mit-learn's SCIM adapter, not here. `LearnUserAdapter`
 * assigns `d.get("fullName", d.get("name", ""))` to `Profile.name`
 * (`users/adapters.py`). `fullName` is a mitodl-custom flat string; `name` is
 * the RFC 7643 complex attribute, a dict — the base adapter reads
 * `d["name"]["givenName"]` two lines earlier. When Keycloak's SCIM push omits
 * `fullName`, the fallback stores the dict, and Django stringifies it onto a
 * `TextField`. `dim_user` then prefers that over MITx Online's clean name and
 * over `concat(first_name, ' ', last_name)`, because the dict repr is
 * non-empty.
 *
 * # What this does NOT fix
 *
 * The stored string is unchanged, so anything the server does with it is
 * still wrong:
 *
 * - **Full-name search returns nothing.** Search is server-side,
 *   `LOWER(full_name) LIKE '%anna gavrilman%'`, and the raw string has
 *   `', 'familyName': '` between the two words. Single tokens ("anna") still
 *   match. This workaround makes the failure *more* likely to be hit: a
 *   manager who can now read "Anna Gavrilman" will try typing it.
 * - **Sort order is wrong.** `ORDER BY full_name ASC` on StarRocks compares
 *   by code point, and `{` (0x7B) sorts past `z`, so every corrupted row
 *   lands in a block at the end of the list. Today that reads as "the broken
 *   ones are grouped together"; once the names render normally it just looks
 *   arbitrary.
 * - **Searching `name`, `given` or `family` matches every corrupted row.**
 * - **Every other consumer of the same column** — the b2b-learner-records
 *   API and anything else reading `dim_user.full_name`.
 *
 * # Permanent fix
 *
 * Tracked in mitodl/hq#13750. Three parts, all backend: drop the `name`
 * fallback in the adapter, repair the dead `_handle_replace_nested_path`
 * override so SCIM PATCH lands, and backfill the corrupted rows (either in
 * mit-learn, or at Keycloak via mitxonline's
 * `remediate_keycloak_user_names --apply`). Delete this module once the
 * backfill has propagated through `dim_user`.
 */
const learnerDisplayName = (fullName: string | null): string | null => {
  if (!fullName) return null
  return parseStringifiedScimName(fullName) || fullName.trim() || null
}

export { learnerDisplayName }
