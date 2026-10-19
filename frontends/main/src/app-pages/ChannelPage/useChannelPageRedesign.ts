import { useFeatureFlagEnabled } from "posthog-js/react"
import { ChannelTypeEnum } from "api/v0"
import { FeatureFlags } from "@/common/feature_flags"

/**
 * Whether this channel draws its redesigned page.
 *
 * Three things switch on it -- the hero, whether the description is drawn
 * above the results, and the layout of the results themselves -- and they
 * have to agree, so they ask here rather than each testing the channel type
 * for itself.
 *
 * A flag of its own per channel type, so a department page can be turned on
 * without a topic page being ready, or the other way about. Both are read
 * every time, hooks being no place for a condition; which one is answered
 * with is the channel's.
 *
 * A flag that has not resolved reads as off, which draws the page every other
 * channel draws. That is the page these channels had before the redesign, so
 * the fallback is the old page rather than an empty one.
 */
const useChannelPageRedesign = (channelType: string): boolean => {
  const topicEnabled = useFeatureFlagEnabled(FeatureFlags.TopicPageRedesign)
  const departmentEnabled = useFeatureFlagEnabled(
    FeatureFlags.DepartmentPageRedesign,
  )

  if (channelType === ChannelTypeEnum.Topic) {
    return topicEnabled === true
  }
  if (channelType === ChannelTypeEnum.Department) {
    return departmentEnabled === true
  }
  return false
}

export default useChannelPageRedesign
