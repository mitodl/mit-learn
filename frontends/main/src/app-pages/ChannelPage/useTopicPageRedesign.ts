import { useFeatureFlagEnabled } from "posthog-js/react"
import { ChannelTypeEnum } from "api/v0"
import { FeatureFlags } from "@/common/feature_flags"

/**
 * Whether this channel draws the redesigned topic page.
 *
 * Three things switch on it -- the hero, whether the description is drawn
 * above the results, and the layout of the results themselves -- and they
 * have to agree, so they ask here rather than each testing the channel type
 * for itself.
 *
 * A flag that has not resolved reads as off, which draws the page every other
 * channel draws. That is the page a topic had before the redesign, so the
 * fallback is the old page rather than an empty one.
 */
const useTopicPageRedesign = (channelType: string): boolean => {
  const enabled = useFeatureFlagEnabled(FeatureFlags.TopicPageRedesign)
  return channelType === ChannelTypeEnum.Topic && enabled === true
}

export default useTopicPageRedesign
