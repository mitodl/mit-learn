import { env } from "@/env"
import React from "react"
import { SearchInput } from "ol-components"
import type { SearchInputProps, SearchSubmissionEvent } from "ol-components"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { trackSiteSearch } from "@/common/analytics/gtm"

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
  const posthog = usePostHog()
  const handleSubmit: SearchInputProps["onSubmit"] = (
    event,
    { isEnter } = {},
  ) => {
    const query = event.target.value
    onSubmit(event)
    setPage?.(1)
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      // onSubmit starts a router navigation that has not committed yet, so the
      // $current_url posthog attaches still holds the previous query. Send the
      // submitted string rather than letting the term be inferred from the URL.
      posthog.capture(PostHogEvents.SearchUpdate, { query, isEnter })
    }
    trackSiteSearch(query)
  }

  return <SearchInput onSubmit={handleSubmit} {...others} />
}

export { SearchField }
