import { createContext, useContext } from "react"

/**
 * Whether PostHog's flags are final for the visitor this page ends up
 * identified as. ConfiguredPostHogProvider sets it.
 *
 * `true` by default: without a PostHog api key, and outside the provider, the
 * env defaults are the final values.
 */
const FeatureFlagsLoadedContext = createContext(true)

/**
 * Returns `true` once PostHog's feature flags are final for this visitor, or
 * once loading them has failed or timed out; `false` until then.
 *
 * NOTES:
 * 1. Avoid using this! Really!:
 *   - A page that waits on this shows its loading state until PostHog answers.
 *     `useFeatureFlag` meanwhile reads the flags PostHog stored on an earlier
 *     visit, or the env default, which is right for almost every flag.
 *
 *     USE CASE: an entire page is behind a feature flag. It shouldn't 404 or
 *     403 until the flag is final: once a page throws `notFound()`, Next keeps
 *     showing the 404 until the visitor navigates, even if the flag turns on.
 * 2. It never goes back to `false`. Later flag updates (another tab's load,
 *    an identity change) change flag values, not this.
 */
const useFeatureFlagsLoaded = () => useContext(FeatureFlagsLoadedContext)

export { useFeatureFlagsLoaded, FeatureFlagsLoadedContext }
