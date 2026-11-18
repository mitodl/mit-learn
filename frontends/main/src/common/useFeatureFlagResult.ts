import posthog from "posthog-js"
import * as Sentry from "@sentry/nextjs"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { InferType, Schema } from "yup"
import type { FeatureFlags } from "./feature_flags"

const subscribe = (onChange: () => void) => posthog.onFeatureFlags(onChange)

type FlagResult<T> = {
  enabled: boolean
  variant: string | undefined
  payload: T | undefined
}

/**
 * A feature flag's PostHog result, with its payload validated against
 * `schema`.
 *
 * `undefined` during SSR and hydration, and before PostHog answers. `payload`
 * is `undefined` when the flag has none for this visitor and when it fails
 * `schema`. A payload that fails is reported to Sentry: PostHog stores
 * payloads as unchecked JSON, so a bad edit there would otherwise just make
 * whatever reads it disappear.
 */
const useFeatureFlagResult = <S extends Schema>(
  flag: FeatureFlags,
  schema: S,
): FlagResult<InferType<S>> | undefined => {
  /**
   * The snapshot is the result as a JSON string, not the result object:
   * useSyncExternalStore re-renders whenever the snapshot is not Object.is
   * equal to the last one, and equal strings always are.
   */
  const json = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(posthog.getFeatureFlagResult(flag) ?? null),
    () => undefined,
  )
  const parsed = useMemo(() => {
    if (json === undefined || json === "null") return undefined
    const { enabled, variant, payload } = JSON.parse(json)
    const result: FlagResult<InferType<S>> = {
      enabled,
      variant,
      payload: undefined,
    }
    if (payload === undefined || payload === null) return { result }
    try {
      result.payload = schema.validateSync(payload, { stripUnknown: true })
      return { result }
    } catch (error) {
      return { result, error, payload }
    }
  }, [json, schema])

  useEffect(() => {
    if (parsed?.error === undefined) return
    Sentry.captureException(parsed.error, {
      tags: { feature_flag: flag },
      extra: { payload: JSON.stringify(parsed.payload) },
    })
  }, [parsed, flag])

  return parsed?.result
}

export { useFeatureFlagResult }
