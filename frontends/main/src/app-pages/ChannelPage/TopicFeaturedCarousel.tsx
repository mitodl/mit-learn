import React from "react"
import { styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { channelQueries } from "api/hooks/channels"
import ResourceCarousel from "@/page-components/ResourceCarousel/ResourceCarousel"
import type { TabConfig } from "@/page-components/ResourceCarousel/types"
import { FEATURED_COUNT, featuredParams } from "./topicFeatured"
import type { FeaturedChannelType } from "./topicFeatured"

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
  marginBottom: "-31px",
  ".MitCarousel-track": {
    marginTop: 0,
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
  /** Which kind of channel the name belongs to -- the path carries both. */
  channelType: FeaturedChannelType
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
/**
 * Whether the row will draw anything.
 *
 * Exported because the hero around it is drawn differently with no Featured
 * row to carry -- the design frames the photograph for the shorter hero that
 * leaves, not for a tall one cropped down. React Query serves one request
 * however many readers ask.
 *
 * Reads as "not empty" while loading, so the hero does not frame itself for a
 * short page and then reframe when the row arrives.
 */
const useTopicFeaturedIsEmpty = (
  channelType: FeaturedChannelType,
  name: string,
): boolean => {
  const params = React.useMemo(
    () => featuredParams(channelType, name),
    [channelType, name],
  )
  const { data, isLoading } = useQuery({
    ...channelQueries.featured(params),
    enabled: Boolean(name),
  })
  return !name || (!isLoading && !data?.results?.length)
}

const TopicFeaturedCarousel: React.FC<TopicFeaturedCarouselProps> = ({
  name,
  channelType,
}) => {
  const params = React.useMemo(
    () => featuredParams(channelType, name),
    [channelType, name],
  )

  const config: TabConfig[] = React.useMemo(
    () => [
      {
        label: "Featured",
        size: "medium",
        data: { type: "channel_featured", params },
      },
    ],
    [params],
  )

  /**
   * The carousel hides itself once it knows the row is empty, but this
   * wrapper would stay behind as an empty flex item -- and the hero spaces
   * its children 64px apart, so an empty one is 64px of blank hero. The same
   * query answers both; React Query serves one request for the two readers.
   */
  if (useTopicFeaturedIsEmpty(channelType, name)) {
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
export { FEATURED_COUNT, useTopicFeaturedIsEmpty }
