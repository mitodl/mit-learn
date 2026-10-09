import React from "react"
import { styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { ChannelTypeEnum } from "api/v0"
import { channelQueries } from "api/hooks/channels"
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
 * two always travel together: this component renders nothing at all when the
 * channel features nothing.
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
  /**
   * The paging arrows are lifted off the hero photograph they sit over, which
   * the carousel does not do elsewhere -- its other callers put it on a plain
   * ground. Addressed by the group's own label rather than a generated class,
   * since the arrows are portalled in from the carousel component.
   */
  '[aria-label="Slide navigation"] button': {
    boxShadow: "0 1px 3px 0 rgba(120, 147, 172, 0.4)",
  },
}))

type TopicFeaturedCarouselProps = {
  /** The channel's `name`, as it appears in the page's own URL. */
  name: string
}

/**
 * The "Featured" row on a topic channel.
 *
 * Curated rather than queried: the items are whatever an editor put in the
 * channel's featured learning path, in that order. A search would re-rank
 * itself as the catalogue changed, which is the opposite of what a curated
 * row is for.
 *
 * It reads the channel's own featured endpoint, which takes the channel from
 * the URL. So the row starts loading with the page rather than waiting on the
 * channel detail request to learn the path's id, and it still shows a path the
 * editors have not published -- these lists are routinely curated unpublished,
 * and the aggregated featured endpoint drops them.
 *
 * Renders nothing when the channel features nothing. An empty "Featured"
 * heading above a blank strip reads as a failure, and the sections below it
 * stand on their own.
 */
const TopicFeaturedCarousel: React.FC<TopicFeaturedCarouselProps> = ({
  name,
}) => {
  const params = React.useMemo(
    () => ({
      channel_type: ChannelTypeEnum.Topic,
      name,
      limit: FEATURED_COUNT,
    }),
    [name],
  )

  const config: TabConfig[] = React.useMemo(
    () => [{ label: "Featured", data: { type: "channel_featured", params } }],
    [params],
  )

  /**
   * The carousel hides itself once it knows the row is empty, but this
   * wrapper would stay behind as an empty flex item -- and the hero spaces
   * its children 64px apart, so an empty one is 64px of blank hero. The same
   * query answers both; React Query serves one request for the two readers.
   */
  const { data, isLoading } = useQuery({
    ...channelQueries.featured(params),
    enabled: Boolean(name),
  })
  const isEmpty = !isLoading && !data?.results?.length

  if (!name || isEmpty) {
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
