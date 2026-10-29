import React, { useEffect, useState } from "react"
import posthog from "posthog-js"
import type { BootstrapConfig } from "posthog-js"
import { PostHogContext, PostHogProvider, usePostHog } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"
import { INTERNAL_BOOTSTRAPPING_FLAG } from "@/common/feature_flags"
import { env, fullEnv } from "@/env"

type FlagValue = boolean | string

/**
 * posthog-js/react reads a bootstrapped flag as enabled when it is truthy, so
 * "false" has to become `false`: left as a string it would read as on.
 */
const parseFlagValue = (value: string): FlagValue => {
  const lowered = value.toLowerCase()
  if (lowered === "true") return true
  if (lowered === "false") return false
  return value
}

/**
 * Compute PostHog bootstrap feature flags from the runtime env (fullEnv()),
 * not from process.env at build time: CI builds the image without per-env
 * values, so build-time values would be empty.
 */
const getBootstrapFeatureFlags = (): Record<string, FlagValue> | null => {
  if (typeof window === "undefined") return null
  const prefix = env("NEXT_PUBLIC_POSTHOG_FEATURE_PREFIX") ?? "FEATURE_"
  const envSource = fullEnv()
  const fullPrefix = `NEXT_PUBLIC_${prefix}`
  const flags: Record<string, FlagValue> = {}

  for (const [key, value] of Object.entries(envSource)) {
    if (value !== undefined && key.startsWith(fullPrefix)) {
      const flagName = key.replace(fullPrefix, "").replaceAll("_", "-")
      flags[flagName] = parseFlagValue(value)
    }
  }

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
    if (user.is_authenticated) {
      /**
       * Identify by the Keycloak global id rather than our Django user id.
       * This posthog project is shared with other MIT applications, and
       * mitxpro identifies people by its own integer user ids, so integer ids
       * collide across applications. Users with no global id are left
       * unidentified rather than identified by a colliding id.
       */
      if (user.global_id) {
        posthog.identify(user.global_id)
      }
    } else if (!anonymous) {
      posthog.reset()
    }
  }, [user, posthog])
  return null
}

/**
 * Without an api key nothing ever loads flags from a PostHog server, so the
 * env flags are the final values rather than placeholders. They go into the
 * context's bootstrap slot, which posthog-js/react's hooks read while the
 * client has loaded no flags. Set after mount, as the keyed path's init is, so
 * the server render and hydration agree.
 */
const EnvFlagsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [bootstrap, setBootstrap] = useState<BootstrapConfig>()
  useEffect(() => {
    setBootstrap({ featureFlags: getBootstrapFeatureFlags() ?? {} })
  }, [])
  return (
    <PostHogContext.Provider value={{ client: posthog, bootstrap }}>
      {children}
    </PostHogContext.Provider>
  )
}

const ConfiguredPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const POSTHOG_API_KEY = env("NEXT_PUBLIC_POSTHOG_API_KEY")
    const POSTHOG_API_HOST = env("NEXT_PUBLIC_POSTHOG_API_HOST")
    const POSTHOG_UI_HOST = env("NEXT_PUBLIC_POSTHOG_UI_HOST")
    if (POSTHOG_API_KEY) {
      const featureFlags = getBootstrapFeatureFlags()
      posthog.init(POSTHOG_API_KEY, {
        api_host: POSTHOG_API_HOST,
        ui_host: POSTHOG_UI_HOST,
        /**
         * Pins the posthog-js default set to a known date. Without it,
         * capture_pageview resolves to `true` (hard page loads only) rather
         * than "history_change", so App Router navigations produce no
         * $pageview. At posthog-js 1.442.0 this date changes nothing else:
         * every other default it gates flips on 2025-11-30 or later.
         */
        defaults: "2025-05-24",
        /**
         * posthog-js otherwise reloads flags every five minutes while the tab
         * is visible. A reload that flips a page-level flag swaps the page
         * under the reader, so flags load once per page load.
         */
        remote_config_refresh_interval_ms: 0,
        // Scope the posthog cookie to this site's exact domain. Posthog
        // defaults this to true, which sets the cookie on the root domain
        // (e.g. mit.edu), sharing it with every other site there.
        cross_subdomain_cookie: false,
        bootstrap: {
          featureFlags: featureFlags
            ? {
                ...featureFlags,
                [INTERNAL_BOOTSTRAPPING_FLAG]: true,
              }
            : undefined,
        },
      })
      /**
       * posthog-js counts bootstrapped flags as already loaded, so when init
       * has a bootstrap it never requests /flags, and INTERNAL_BOOTSTRAPPING_FLAG
       * stays set, leaving useFeatureFlagsLoaded false. Request them
       * explicitly. Without a bootstrap, init's own first load sees this
       * request pending and skips, so either way one request goes out.
       */
      posthog.reloadFeatureFlags()
    }
  }, [])

  if (!env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
    return <EnvFlagsProvider>{children}</EnvFlagsProvider>
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
