import { usePostHog } from "posthog-js/react"
import type { UseResourceSearchParamsResult } from "@mitodl/course-search-utils"
import { env } from "@/env"
import { PostHogEvents } from "@/common/constants"
import { trackFilterCourseCatalog } from "@/common/analytics/gtm"

type Setters = Pick<
  UseResourceSearchParamsResult,
  "setParamValue" | "toggleParamValue"
>

/**
 * The search filter setters, wrapped to report what was changed.
 *
 * Held here rather than inside whichever component happens to draw the
 * controls, because a page can draw them in more than one place: a topic
 * channel has its own filter bar beside the results as well as the facets the
 * results display carries, and setters that reported only from one of them
 * would quietly undercount the other.
 *
 * Wrap once per page and hand the result to every control. Wrapping a second
 * time -- around setters that are already wrapped -- reports each change
 * twice.
 */
const useTrackedFilterSetters = ({
  setParamValue,
  toggleParamValue,
}: Setters) => {
  const posthog = usePostHog()
  const hasPostHog = !!env("NEXT_PUBLIC_POSTHOG_API_KEY")

  const captureFilterEvent = (control: string) => {
    if (hasPostHog) {
      posthog.capture(PostHogEvents.SearchFilterUpdate, { control })
    }
  }

  return {
    captureFilterEvent,
    setParamValue: (name: string, rawValue: string | string[]) => {
      setParamValue(name, rawValue)
      captureFilterEvent(name)
    },
    toggleParamValue: (name: string, rawValue: string, checked: boolean) => {
      toggleParamValue(name, rawValue, checked)
      captureFilterEvent(name)
      /* Only what was added: the catalog funnel counts filters applied. */
      if (checked) {
        trackFilterCourseCatalog({ filterName: name, filterValue: rawValue })
      }
    },
  }
}

export { useTrackedFilterSetters }
