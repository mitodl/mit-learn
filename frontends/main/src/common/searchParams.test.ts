import { resourceSearchValidators } from "@mitodl/course-search-utils"
import { RESOURCE_SEARCH_PARAMS } from "./searchParams"
import type { AppPageProps } from "./searchParams"

/**
 * If this fails, a @mitodl/course-search-utils upgrade changed the search
 * param set. The Fastly cache-key whitelist must be updated FIRST —
 * ol-infrastructure: src/ol_infrastructure/applications/mit_learn/snippets/cache_key_query_whitelist.vcl
 * — then update RESOURCE_SEARCH_PARAMS to match. See hq#12925.
 */
test("RESOURCE_SEARCH_PARAMS stays in sync with resourceSearchValidators", () => {
  expect([...RESOURCE_SEARCH_PARAMS].sort()).toEqual(
    Object.keys(resourceSearchValidators).sort(),
  )
})

/**
 * Type-level pins. Enforced by `yarn workspace frontends run typecheck`,
 * not at jest runtime. If the searchParams narrowing regresses, the
 * ts-expect-error below becomes "unused" and typecheck fails.
 */
type SearchPageProps = AppPageProps<"/search">
const typeChecks = async (props: SearchPageProps) => {
  const q: string | string[] | undefined = (await props.searchParams).q
  // @ts-expect-error -- params outside SERVER_KEYED are not readable server-side
  const junk = (await props.searchParams).utm_source
  return [q, junk]
}
void typeChecks
