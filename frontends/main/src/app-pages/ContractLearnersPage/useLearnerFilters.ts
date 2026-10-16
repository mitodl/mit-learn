import { useEffect, useMemo, useState } from "react"
import type { CompletionStatusFilter } from "api/analytics-hooks/organizations"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import {
  CONTRACT_LEARNERS_STATUSES,
  type ContractLearnersStatus,
} from "@/common/urls"

const ALL = "all"
const SEARCH_DEBOUNCE_MS = 300
/** Matches the API's cap on `search`; truncated below rather than sent as-is, since a long paste would otherwise 422 and read as "Something went wrong loading learner data" — 422 isn't in the page's error-boundary set. */
const SEARCH_MAX_LENGTH = 254

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

type DirectoryParam = "status" | "module" | "needs_attention" | "page"

const replaceSearchParams = (
  changes: Partial<Record<DirectoryParam, string | null>>,
) => {
  const params = new URLSearchParams(window.location.search)
  for (const [name, value] of Object.entries(changes)) {
    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }
  }
  const search = params.toString()
  window.history.replaceState(
    null,
    "",
    search ? `?${search}` : window.location.pathname,
  )
}

/**
 * The filters both learner views share. Status, module and needs-attention
 * live in the URL; the search text deliberately does not, because it is a
 * learner's name or email and the URL is recorded by PostHog and Sentry.
 * `onChange` runs whenever a filter settles on a new value, so each view can
 * send its own pagination back to page 1; typing in the search box only
 * reports once the debounce lands.
 */
const useLearnerFilters = (onChange: () => void) => {
  const searchParams = useAppSearchParams()
  const statusParam = searchParams.get("status")
  const statusFilter = isStatus(statusParam) ? statusParam : ALL
  const needsAttentionOnly = searchParams.get("needs_attention") === "true"
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  const applyFilterChange = (
    changes: Partial<Record<Exclude<DirectoryParam, "page">, string | null>>,
  ) => {
    replaceSearchParams({ ...changes, page: null })
    onChange()
  }

  useEffect(() => {
    if (searchQuery === debouncedSearch) return
    const id = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      replaceSearchParams({ page: null })
      onChange()
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [searchQuery, debouncedSearch, onChange])

  const completionStatus = useMemo<CompletionStatusFilter[] | undefined>(
    () =>
      statusFilter === ALL
        ? undefined
        : STATUS_FILTER_COMPLETION_STATUS[statusFilter],
    [statusFilter],
  )

  return {
    searchQuery,
    setSearchQuery,
    clearSearch: () => {
      setSearchQuery("")
      setDebouncedSearch("")
      applyFilterChange({})
    },
    debouncedSearch,
    statusFilter,
    setStatusFilter: (value: string) =>
      applyFilterChange({ status: value === ALL ? null : value }),
    completionStatus,
    needsAttentionOnly,
    setNeedsAttentionOnly: (value: boolean) =>
      applyFilterChange({ needs_attention: value ? "true" : null }),
    setModuleFilter: (value: string) =>
      applyFilterChange({ module: value === ALL ? null : value }),
  }
}

export { ALL, SEARCH_MAX_LENGTH, replaceSearchParams, useLearnerFilters }
