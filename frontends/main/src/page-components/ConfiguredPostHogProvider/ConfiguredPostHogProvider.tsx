import React, { useEffect } from "react"
import posthog from "posthog-js"
import { PostHogProvider, usePostHog } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"
import { FeatureFlags, INTERNAL_BOOTSTRAPPING_FLAG } from "@/common/feature_flags"
import { env } from "@/env"

// LOCAL DEV OVERRIDE: force-enable feature flags without a PostHog account.
// Remove entries here when done testing locally.
const LOCAL_FLAG_OVERRIDES: Partial<Record<FeatureFlags, boolean>> = {
  [FeatureFlags.MitxOnlineProductPages]: true,
}

/**
 * Compute PostHog bootstrap feature flags from window.__ENV at runtime.
 * Previously this was computed at build time from process.env in next.config.js
 * (as FEATURE_FLAGS), but that approach bakes empty values when the Docker
 * image is built in CI without per-environment values. Reading from
 * window.__ENV gives the correct per-env flags injected by PublicEnvScript.
 */
const getBootstrapFeatureFlags = (): Record<
  string,
  boolean | string
> | null => {
  if (typeof window === "undefined") return null
  const envSource = window.__ENV ?? {}
  const prefix = envSource["NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX"] ?? "FEATURE_"
  const fullPrefix = `NEXT_PUBLIC_${prefix}`
  const flags: Record<string, boolean | string> = {}

  for (const [key, value] of Object.entries(envSource)) {
    if (value !== undefined && key.startsWith(fullPrefix)) {
      const flagName = key.replace(fullPrefix, "").replaceAll("_", "-")
      flags[flagName] = value === "True" ? true : JSON.stringify(value)
    }
  }


  Object.assign(flags, LOCAL_FLAG_OVERRIDES)

  return Object.keys(flags).length > 0 ? flags : null
}

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

const ConfiguredPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const POSTHOG_API_KEY =
      env("NEXT_PUBLIC_POSTHOG_API_KEY") ||
      (Object.keys(LOCAL_FLAG_OVERRIDES).length > 0
        ? "local-dev-override"
        : undefined)
    const POSTHOG_API_HOST = env("NEXT_PUBLIC_POSTHOG_API_HOST")
    const POSTHOG_UI_HOST = env("NEXT_PUBLIC_POSTHOG_UI_HOST")
    if (POSTHOG_API_KEY) {
      const featureFlags = getBootstrapFeatureFlags()
      posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_API_HOST,
        ui_host: POSTHOG_UI_HOST,
        bootstrap: {
          featureFlags: featureFlags
            ? {
                ...featureFlags,
                [INTERNAL_BOOTSTRAPPING_FLAG]: true,
              }
            : undefined,
        },
      })
    }
  }, [])

  if (!env("NEXT_PUBLIC_POSTHOG_API_KEY") && !Object.keys(LOCAL_FLAG_OVERRIDES).length) {
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
