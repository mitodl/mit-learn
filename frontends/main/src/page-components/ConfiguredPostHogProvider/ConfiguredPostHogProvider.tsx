import React, { useEffect } from "react"
import posthog from "posthog-js"
import { PostHogProvider, usePostHog } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"

const PosthogIdentifier = () => {
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

const POSTHOG_API_KEY = process.env.NEXT_PUBLIC_POSTHOG_API_KEY
const POSTHOG_API_HOST = process.env.NEXT_PUBLIC_POSTHOG_API_HOST

const ConfiguredPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const featureFlags = JSON.parse(process.env.FEATURE_FLAGS || "")

    if (POSTHOG_API_KEY) {
      console.info("Initializing PostHog")
      posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_API_HOST,
        bootstrap: {
          featureFlags,
        },
      })
    }
  }, [])

  if (!POSTHOG_API_KEY) {
    return children
  }

  return (
    <PostHogProvider client={posthog}>
      <PosthogIdentifier />
      {children}
    </PostHogProvider>
  )
}

export default ConfiguredPostHogProvider
export { PosthogIdentifier }
