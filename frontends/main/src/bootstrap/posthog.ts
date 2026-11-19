import posthog from "posthog-js"
import { env } from "@/env"
import { initPostHog } from "@/common/analytics/posthog"

/**
 * Requests flags now, and resolves once PostHog has answered or the request
 * has failed.
 *
 * `cancelled` means posthog-js reset its flags for an identity change (a
 * `reset()`, another tab logging in or out, a back/forward-cache restore) and
 * is reloading for the new identity, so wait for that reload instead.
 */
const loadFlags = (): Promise<void> => {
  const reload = posthog.featureFlags?.reloadFeatureFlagsAsync()
  if (!reload) return Promise.resolve()
  return reload.then((result) =>
    result.status === "cancelled" ? loadFlags() : undefined,
  )
}

let firstFlagLoad: Promise<void> | undefined

/**
 * Initializes posthog and starts the page's first flag request.
 * instrumentation-client.ts calls this, so it runs before hydration: posthog
 * holds the flags it stored on an earlier visit before any component reads
 * them, and identify can't run before init.
 *
 * Does nothing without an api key, or inside an iframe: there third-party
 * cookies are blocked or partitioned, and the embed shows none of our privacy
 * notices while the host site answers for what it collects
 * (https://github.com/mitodl/mit-learn/pull/3327#discussion_r3261034458).
 *
 * First-wins, like bootstrapApiClients: instrumentation-client.ts can re-run
 * under Fast Refresh.
 */
const bootstrapPostHog = () => {
  if (firstFlagLoad) return
  const apiKey = env("NEXT_PUBLIC_POSTHOG_API_KEY")
  if (!apiKey || window.self !== window.top) return
  posthog.init(apiKey, {
    api_host: env("NEXT_PUBLIC_POSTHOG_API_HOST"),
    ui_host: env("NEXT_PUBLIC_POSTHOG_UI_HOST"),
    /**
     * Pins the posthog-js default set to a known date. Without it,
     * capture_pageview resolves to `true` (hard page loads only) rather than
     * "history_change", so App Router navigations produce no $pageview. At
     * posthog-js 1.442.0 this date changes nothing else: every other default
     * it gates starts on 2025-11-30 or later.
     */
    defaults: "2025-05-24",
    /**
     * posthog-js otherwise reloads flags every five minutes while the tab is
     * visible and in use. A reload that flips a page-level flag swaps the page
     * under the reader, so flags reload only on page load and identity
     * changes.
     */
    remote_config_refresh_interval_ms: 0,
    /**
     * posthog-js otherwise retries a timed-out /flags request once, so a hung
     * PostHog takes about 6.5s to give up per request, and a first load after
     * login (an anonymous request, then an identified one) keeps gated pages
     * on their loading state until ConfiguredPostHogProvider's 10s cap.
     * Waiting that long on a skeleton is worse than an occasional blip falling
     * back to env defaults.
     */
    feature_flag_request_max_retries: 0,
    // Scope the posthog cookie to this site's exact domain. Posthog defaults
    // this to true, which sets the cookie on the root domain (e.g. mit.edu),
    // sharing it with every other site there.
    cross_subdomain_cookie: false,
  })
  initPostHog(posthog)
  /**
   * `reloadFeatureFlagsAsync` (inside `loadFlags`) starts the page's first
   * flag load, sent alongside remote config (config.js) rather than after it.
   * posthog-js's own load then finds it under way or done and skips, so one
   * /flags request goes out. It also skips remote config's gates:
   * `hasFeatureFlags` (false only for a project with no flags) and
   * `advanced_disable_feature_flags_on_first_load` (which we don't set).
   */
  firstFlagLoad = loadFlags()
}

/**
 * The page's first flag load, or `undefined` when bootstrapPostHog didn't
 * start posthog on this page.
 */
const getFirstFlagLoad = () => firstFlagLoad

export { bootstrapPostHog, getFirstFlagLoad, loadFlags }
