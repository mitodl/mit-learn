import React from "react"
import { Breadcrumbs } from "ol-components"
import PodcastContainer from "./PodcastContainer"
import { BreadcrumbBar } from "./PodcastsListingPage/styled"

type PodcastBreadcrumbsProps = {
  ancestors: Array<{ href: string; label: string }>
  current?: string | null
  /** Container width in px (defaults to PodcastContainer's 1080). */
  contentWidth?: number
  /** Desktop horizontal padding in px. */
  gutter?: number
  /** Breakpoint below which a 16px gutter kicks in. */
  gutterBreakpoint?: "md" | "sm"
}

/**
 * The red-underlined breadcrumb bar shared across all podcast pages. Wraps
 * `Breadcrumbs` in the standard `PodcastContainer`; width/gutter props let the
 * listing page use its wider container.
 */
const PodcastBreadcrumbs: React.FC<PodcastBreadcrumbsProps> = ({
  ancestors,
  current,
  contentWidth,
  gutter,
  gutterBreakpoint,
}) => (
  <BreadcrumbBar>
    <PodcastContainer
      contentWidth={contentWidth}
      gutter={gutter}
      gutterBreakpoint={gutterBreakpoint}
    >
      <Breadcrumbs variant="light" ancestors={ancestors} current={current} />
    </PodcastContainer>
  </BreadcrumbBar>
)

export default PodcastBreadcrumbs
