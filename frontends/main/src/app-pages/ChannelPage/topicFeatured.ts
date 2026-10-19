/**
 * What the topic hero's Featured row asks for, kept free of React so the
 * server route can prefetch it under the same key the row will read.
 *
 * The route has to: the hero is drawn differently with no Featured row to
 * carry, so without the answer in hand it paints as though there were one and
 * reframes when the row turns out not to exist. And the key is the params
 * object itself, so naming them twice would stop matching the moment either
 * side changed, leaving the row to fetch again on hydration.
 */
import { ChannelTypeEnum } from "api/v0"

/**
 * How many items of the learning path to carry into the carousel.
 *
 * The row shows four at desktop width and the carousel pages through the rest,
 * so this is the size of the pool rather than what is on screen.
 */
const FEATURED_COUNT = 12

const featuredParams = (name: string) => ({
  channel_type: ChannelTypeEnum.Topic,
  name,
  limit: FEATURED_COUNT,
})

export { FEATURED_COUNT, featuredParams }
