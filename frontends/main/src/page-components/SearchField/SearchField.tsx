import React from "react"
import { SearchInput } from "ol-components"
import type { SearchInputProps, SearchSubmissionEvent } from "ol-components"

type SearchFieldProps = SearchInputProps & {
  onSubmit: (event: SearchSubmissionEvent) => void
  setPage?: (page: number) => void
}

/**
 * A wrapper around SearchInput that handles a little application logic like
 * - resetting search page to 1 on submission
 * - firing tracking events
 */
const SearchField: React.FC<SearchFieldProps> = ({
  onSubmit,
  setPage,
  ...others
}) => {
  const handleSubmit: SearchInputProps["onSubmit"] = (event) => {
    onSubmit(event)
    setPage?.(1)
  }

  return <SearchInput onSubmit={handleSubmit} {...others} />
}

export { SearchField }
