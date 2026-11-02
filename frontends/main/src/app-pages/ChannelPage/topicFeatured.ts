/**
 * What a redesigned channel hero's Featured row asks for, kept free of React
 * so the server route can prefetch it under the same key the row will read.
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

/**
 * The channel types whose pages draw a Featured row.
 *
 * The endpoint reads `featured_list` off whichever channel the path names, so
 * it answers for any type; these are the ones with a hero to draw the answer
 * in.
 */
type FeaturedChannelType =
  typeof ChannelTypeEnum.Topic | typeof ChannelTypeEnum.Department

const featuredParams = (channelType: FeaturedChannelType, name: string) => ({
  channel_type: channelType,
  name,
  limit: FEATURED_COUNT,
})

/**
 * The same type, where it arrives as a bare string -- from a URL, say.
 *
 * Returns the type rather than a boolean so what follows is typed by it, and
 * kept here with `featuredParams` so the server route can ask without reaching
 * for `useChannelPageRedesign`, which is a hook and reads PostHog.
 */
const asRedesignedChannelType = (
  channelType: string,
): FeaturedChannelType | null => {
  if (channelType === ChannelTypeEnum.Topic) {
    return ChannelTypeEnum.Topic
  }
  if (channelType === ChannelTypeEnum.Department) {
    return ChannelTypeEnum.Department
  }
  return null
}

export { FEATURED_COUNT, featuredParams, asRedesignedChannelType }
export type { FeaturedChannelType }
