import type { UseResourceSearchParamsResult } from "@mitodl/course-search-utils"
import { PostHogEvents } from "@/common/constants"
import { capturePostHog } from "./posthog"
import { analytics } from "./index"

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
  const captureFilterEvent = (control: string) => {
    capturePostHog(PostHogEvents.SearchFilterUpdate, { control })
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
        analytics.catalogFiltered({ filterName: name, filterValue: rawValue })
      }
    },
  }
}

export { useTrackedFilterSetters }
