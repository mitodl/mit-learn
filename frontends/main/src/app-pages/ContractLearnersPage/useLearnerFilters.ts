import { useCallback, useEffect, useMemo, useState } from "react"
import type { CompletionStatusFilter } from "api/analytics-hooks/organizations"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import {
  CONTRACT_LEARNERS_STATUSES,
  type ContractLearnersStatus,
} from "@/common/urls"

const ALL = "all"
const SEARCH_DEBOUNCE_MS = 300
/** Past this, a page number is a typo or a hand-edited link, and its offset would overflow what the API accepts. */
const MAX_PAGE = 10_000
/** Matches the API's cap on `search`; truncated rather than sent as-is, since a long paste would otherwise 422 and read as "Something went wrong loading learner data" — 422 isn't in the error-boundary set. */
const SEARCH_MAX_LENGTH = 254
const VIEWS = { enrollments: "enrollments", grid: "grid" } as const
type View = (typeof VIEWS)[keyof typeof VIEWS]

/**
 * "Completed" queries both `passed` and `certified`, matching the count
 * tile above it: a learner who passed but hasn't certified yet is still
 * "Completed" to a manager, and a standalone "Certificate" filter option
 * previously returned fewer rows than the tile it was supposed to explain.
 * The row-level status pill (`getDisplayStatus`) still distinguishes the
 * two outcomes; only the filter groups them.
 */
const STATUS_FILTER_COMPLETION_STATUS: Record<
  ContractLearnersStatus,
  CompletionStatusFilter[]
> = {
  not_started: ["not_started"],
  in_progress: ["in_progress"],
  passed: ["passed", "certified"],
  unknown: ["unknown"],
}

const isStatus = (value: string | null): value is ContractLearnersStatus =>
  (CONTRACT_LEARNERS_STATUSES as readonly (string | null)[]).includes(value)

/**
 * The learner directory's state: the filters both views share, the active
 * view, and the page. View, page, status, module and needs-attention live in
 * the URL; the search text deliberately does not, because it is a learner's
 * name or email and the URL is recorded by PostHog and Sentry. Every URL
 * change is one `history.replaceState`, which Next feeds into
 * `useSearchParams` without a server round trip (the app is `force-dynamic`,
 * so `router.replace` would re-render the route on every filter change). A
 * changed filter, view, or search always lands on page 1.
 */
const useLearnerFilters = () => {
  const params = useAppSearchParams()

  const update = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    )
  }, [])

  const statusParam = params.get("status")
  const statusFilter = isStatus(statusParam) ? statusParam : ALL
  const needsAttentionOnly = params.get("needs_attention") === "true"
  const moduleFilter = params.get("module") ?? ALL
  const view: View =
    params.get("view") === VIEWS.grid ? VIEWS.grid : VIEWS.enrollments
  const parsedPage = parseInt(params.get("page") ?? "", 10)
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= MAX_PAGE
      ? parsedPage
      : 1

  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    if (searchQuery === debouncedSearch) return
    const id = setTimeout(() => {
      setDebouncedSearch(searchQuery.slice(0, SEARCH_MAX_LENGTH))
      update({ page: null })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchQuery, debouncedSearch, update])

  const completionStatus = useMemo<CompletionStatusFilter[] | undefined>(
    () =>
      statusFilter === ALL
        ? undefined
        : STATUS_FILTER_COMPLETION_STATUS[statusFilter],
    [statusFilter],
  )

  return {
    view,
    setView: (next: View) =>
      update({ view: next === VIEWS.grid ? next : null, page: null }),
    page,
    setPage: (next: number) => update({ page: next > 1 ? String(next) : null }),
    searchQuery,
    setSearchQuery,
    clearSearch: () => {
      setSearchQuery("")
      setDebouncedSearch("")
      update({ page: null })
    },
    debouncedSearch,
    statusFilter,
    setStatusFilter: (value: string) =>
      update({ status: value === ALL ? null : value, page: null }),
    completionStatus,
    needsAttentionOnly,
    setNeedsAttentionOnly: (value: boolean) =>
      update({ needs_attention: value ? "true" : null, page: null }),
    moduleFilter,
    setModuleFilter: (value: string) =>
      update({ module: value === ALL ? null : value, page: null }),
    clearAll: () => {
      setSearchQuery("")
      setDebouncedSearch("")
      update({
        status: null,
        module: null,
        needs_attention: null,
        page: null,
      })
    },
  }
}

export { ALL, SEARCH_MAX_LENGTH, VIEWS, useLearnerFilters }
export type { View }
