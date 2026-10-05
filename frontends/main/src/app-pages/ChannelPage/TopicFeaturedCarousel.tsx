import React from "react"
import { styled } from "ol-components"
import { env } from "@/env"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import type { TabConfig } from "@/page-components/ResourceCarousel/types"

/**
 * How many items of the learning path to carry into the carousel.
 *
 * The row shows four at desktop width and the carousel pages through the rest,
 * so this is the size of the pool rather than what is on screen.
 */
const FEATURED_COUNT = 12

/**
 * The design's Featured section is a 32px heading row, 32px, then the cards,
 * with nothing below them -- the hero's own 64px bottom padding is the space
 * there. The shared carousel instead spaces itself 24px under its heading and
 * carries a 24px margin below its track, so both are corrected from here
 * rather than in the shared component, which other pages rely on.
 *
 * The negative margin is safe to pair with the carousel like this because the
 * two always travel together: this component renders nothing at all when no
 * learning path is configured.
 */
const Container = styled.div(({ theme }) => ({
  marginBottom: "-24px",
  ".MitCarousel-track": {
    marginTop: "8px",
  },
  /* The design's heading is darkGray2, where the shared carousel leaves its
     title to inherit black. Scoped here so other carousels are unaffected. */
  h2: {
    color: theme.custom.colors.darkGray2,
  },
}))

/**
 * The "Featured" row on a topic channel.
 *
 * Curated rather than queried: the items come from a learning path whose id is
 * configured per environment, so editors choose what leads the page without a
 * deploy. That is also why it is a learning path and not a search -- a search
 * would re-rank itself as the catalogue changed.
 *
 * Renders nothing at all when no learning path is configured. An empty
 * "Featured" heading above a blank strip reads as a failure, and the sections
 * below it stand on their own.
 */
const TopicFeaturedCarousel: React.FC = () => {
  const configuredId = Number(env("NEXT_PUBLIC_FEATURED_LIST_LEARNINGPATH_ID"))
  /**
   * `Number("")` is 0 and `Number(undefined)` is NaN, so both the unset and
   * the blank cases have to be excluded -- and a non-positive id would be a
   * request for a learning path that cannot exist.
   */
  const hasConfiguredId = Number.isFinite(configuredId) && configuredId > 0

  const config: TabConfig[] = React.useMemo(
    () => [
      {
        label: "Featured",
        data: {
          type: "resource_items",
          params: {
            learning_resource_id: configuredId,
            limit: FEATURED_COUNT,
          },
        },
      },
    ],
    [configuredId],
  )

  if (!hasConfiguredId) {
    return null
  }

  return (
    <Container>
      <ResourceCarousel
        title="Featured"
        titleComponent="h2"
        config={config}
        data-testid="topic-featured-carousel"
      />
    </Container>
  )
}

export default TopicFeaturedCarousel
export { FEATURED_COUNT }
