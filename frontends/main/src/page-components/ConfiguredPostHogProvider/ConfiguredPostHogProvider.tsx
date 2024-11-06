import React, { useEffect } from "react"
import { PostHogProvider, usePostHog } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"
import type { PostHogConfig } from "posthog-js"

const PosthogIdenifier = () => {
  const { data: user } = useUserMe()
  const posthog = usePostHog()
  /**
   * Posthog docs recommend calling `posthog.identify` on signin and
   * `posthog.reset` on signout. But signin and signout generally occur on the
   * SSO server, which users could get to via other means.
   *
   * So instead, when page first loads:
   * 1. Identify user (noop if user already identified)
   * 2. If user is not authenticated AND posthog thinks they are not anonymous,
   *    then reset their posthog state.
   */
  useEffect(() => {
    if (!user) return
    const anonymous = posthog.get_property("$user_state") === "anonymous"
    if (user.is_authenticated && user.id) {
      posthog.identify(String(user.id))
    } else if (!anonymous) {
      posthog.reset()
    }
  }, [user, posthog])
  return null
}

const ConfiguredPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY || ""
  const apiHost =
    process.env.NEXT_PUBLIC_POSTHOG_API_HOST || "https://us.i.posthog.com"
  const featureFlags = JSON.parse(process.env.FEATURE_FLAGS || "")

  const postHogOptions: Partial<PostHogConfig> = {
    api_host: apiHost,
    bootstrap: {
      featureFlags: featureFlags,
    },
  }

  return apiKey ? (
    <PostHogProvider apiKey={apiKey} options={postHogOptions}>
      <PosthogIdenifier />
      {children}
    </PostHogProvider>
  ) : (
    children
  )
}

export default ConfiguredPostHogProvider
export { PosthogIdenifier }
