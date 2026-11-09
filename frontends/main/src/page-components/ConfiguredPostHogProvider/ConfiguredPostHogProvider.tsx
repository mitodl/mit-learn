import React, { useEffect, useRef, useState } from "react"
import posthog from "posthog-js"
import { PostHogProvider } from "posthog-js/react"
import { useUserMe } from "api/hooks/user"
import type { CurrentUser } from "api/hooks/user"
import { FeatureFlagsLoadedContext } from "@/common/useFeatureFlagsLoaded"
import { env } from "@/env"
import { getFirstFlagLoad, loadFlags } from "@/bootstrap/posthog"

/**
 * After this long, pages waiting on useFeatureFlagsLoaded stop waiting, even if
 * PostHog hasn't answered.
 */
const FLAGS_LOADED_CAP_MS = 10_000

/**
 * Posthog docs recommend calling `posthog.identify` on signin and
 * `posthog.reset` on signout. But signin and signout generally occur on the
 * SSO server, which users could get to via other means.
 *
 * So instead, when page first loads:
 * 1. Identify user (noop if user already identified)
 * 2. If user is not authenticated AND posthog thinks they are not anonymous,
 *    then reset their posthog state.
 *
 * Returns the flag load for the new identity when this changed it, else null.
 */
const syncIdentity = (user: CurrentUser): Promise<void> | null => {
  if (user.is_authenticated) {
    /**
     * Identify by the Keycloak global id rather than our Django user id.
     * This posthog project is shared with other MIT applications, and
     * mitxpro identifies people by its own integer user ids, so integer ids
     * collide across applications. Users with no global id are left
     * unidentified rather than identified by a colliding id.
     */
    if (!user.global_id) return null
    const previousId = posthog.get_distinct_id()
    posthog.identify(user.global_id)
    /**
     * identify reloads flags only when it changes the distinct id. This load
     * joins that reload: while a request is in flight, posthog-js serves
     * later loads from the follow-up request it queues for the new id.
     */
    return posthog.get_distinct_id() === previousId ? null : loadFlags()
  }
  if (posthog.get_property("$user_state") === "anonymous") return null
  posthog.reset()
  return loadFlags()
}

const KeyedPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [flagsLoaded, setFlagsLoaded] = useState(false)
  /** The flag load for the identity this page currently has. */
  const currentLoad = useRef<Promise<void>>(undefined)
  const cap = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { data: user, isError } = useUserMe()

  /**
   * Adopts the first flag load bootstrapPostHog started. Declared before the
   * identity effect, so `currentLoad` is set by the time that runs: React runs
   * a component's effects in order.
   *
   * With no first load, posthog isn't running on this page (it's in an iframe,
   * or init threw), so there's nothing to wait for. That's decided here rather
   * than by rendering the keyless provider, because the server can't tell:
   * it renders with flags not yet loaded, and so must the hydration render.
   *
   * Strict Mode replays this effect after the identity effect has run, on the
   * same refs, so it keeps a load the identity effect already set.
   */
  useEffect(() => {
    const firstLoad = getFirstFlagLoad()
    if (!firstLoad) {
      setFlagsLoaded(true)
      return
    }
    currentLoad.current ??= firstLoad
    cap.current = setTimeout(() => {
      console.warn(
        `PostHog feature flags did not load within ${FLAGS_LOADED_CAP_MS / 1000}s; pages waiting on flags now decide on stored flags or env defaults.`,
      )
      setFlagsLoaded(true)
    }, FLAGS_LOADED_CAP_MS)
    return () => clearTimeout(cap.current)
  }, [])

  /**
   * Flags are final once they're evaluated for the identity this page ends
   * up with: after /me, and after any reload identify or reset starts. The
   * page's first /flags response may be for the anonymous id. A /me change
   * that leaves the identity alone (a refetch with new profile data) keeps
   * waiting on the current identity's load. A load that a later identity
   * change has replaced is ignored, so an anonymous answer that lands after
   * /me has identified the visitor doesn't mark flags loaded. Without a
   * current load, posthog isn't running, so there's no identity to sync.
   */
  useEffect(() => {
    if (!currentLoad.current || (!user && !isError)) return
    const load = (user ? syncIdentity(user) : null) ?? currentLoad.current
    currentLoad.current = load
    load.then(() => {
      if (load !== currentLoad.current) return
      clearTimeout(cap.current)
      setFlagsLoaded(true)
    })
  }, [user, isError])

  return (
    <PostHogProvider client={posthog}>
      <FeatureFlagsLoadedContext.Provider value={flagsLoaded}>
        {children}
      </FeatureFlagsLoadedContext.Provider>
    </PostHogProvider>
  )
}

/**
 * Without an api key nothing loads flags from a PostHog server, so the env
 * defaults that useFeatureFlag falls back to are final, and
 * useFeatureFlagsLoaded keeps its default, `true`.
 */
const ConfiguredPostHogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const apiKey = env("NEXT_PUBLIC_POSTHOG_API_KEY")
  if (!apiKey) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>
  }
  return <KeyedPostHogProvider>{children}</KeyedPostHogProvider>
}

export default ConfiguredPostHogProvider
