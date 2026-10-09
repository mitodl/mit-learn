import { useEffect, useMemo, useState } from "react"
import type { CompletionStatusFilter } from "api/analytics-hooks/organizations"

const ALL = "all"
const SEARCH_DEBOUNCE_MS = 300

/**
 * "Completed" queries both `passed` and `certified`, matching the count
 * tile above it: a learner who passed but hasn't certified yet is still
 * "Completed" to a manager, and a standalone "Certificate" filter option
 * previously returned fewer rows than the tile it was supposed to explain.
 * The row-level status pill (`getDisplayStatus`) still distinguishes the
 * two outcomes; only the filter groups them.
 */
const STATUS_FILTER_COMPLETION_STATUS: Record<
  string,
  CompletionStatusFilter[]
> = {
  not_started: ["not_started"],
  in_progress: ["in_progress"],
  passed: ["passed", "certified"],
  unknown: ["unknown"],
}

/**
 * The filters both learner views share. `onChange` runs whenever a filter
 * settles on a new value, so each view can send its own pagination back to
 * page 1; typing in the search box only reports once the debounce lands.
 */
const useLearnerFilters = (onChange: () => void) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilterState] = useState<string>(ALL)
  const [needsAttentionOnly, setNeedsAttentionOnlyState] = useState(false)

  useEffect(() => {
    if (searchQuery === debouncedSearch) return
    const id = setTimeout(() => {
      setDebouncedSearch(searchQuery)
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
      onChange()
    },
    debouncedSearch,
    statusFilter,
    setStatusFilter: (value: string) => {
      setStatusFilterState(value)
      onChange()
    },
    completionStatus,
    needsAttentionOnly,
    setNeedsAttentionOnly: (value: boolean) => {
      setNeedsAttentionOnlyState(value)
      onChange()
    },
  }
}

export { ALL, useLearnerFilters }
