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
 * The topic page is the redesign now -- the page it had before has been
 * removed, so there is nothing left to switch between and it answers yes
 * without asking PostHog.
 *
 * The department page is still behind a flag of its own, so it can be turned
 * on when it is ready. A flag that has not resolved reads as off, which draws
 * the page every other channel draws. That is the page the department page had
 * before the redesign, so the fallback is the old page rather than an empty
 * one.
 */
const useChannelPageRedesign = (channelType: string): boolean => {
  const departmentEnabled = useFeatureFlagEnabled(
    FeatureFlags.DepartmentPageRedesign,
  )

  if (channelType === ChannelTypeEnum.Topic) {
    return true
  }
  if (channelType === ChannelTypeEnum.Department) {
    return departmentEnabled === true
  }
  return false
}

/**
 * Whether a flag decides anything for this channel type.
 *
 * Only the department page, now that the topic page answers above without
 * reading a flag at all; every other channel draws the one page it has always
 * drawn, whatever the flags say. Worth asking before waiting on the flags to
 * arrive -- there is nothing for them to change.
 *
 * Lives here rather than at the caller so the list cannot fall out of step
 * with the one the hook branches on.
 */
const channelTypeUsesRedesignFlag = (channelType: string): boolean =>
  channelType === ChannelTypeEnum.Department

export default useChannelPageRedesign
export { channelTypeUsesRedesignFlag }
