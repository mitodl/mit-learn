import posthog from "posthog-js"
import * as Sentry from "@sentry/nextjs"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { InferType, Schema } from "yup"
import type { FeatureFlags } from "./feature_flags"

const subscribe = (onChange: () => void) => posthog.onFeatureFlags(onChange)

type Parsed<T> =
  { value: T; error?: undefined } | { value?: undefined; error: unknown }

/**
 * A feature flag's PostHog payload, validated against `schema`.
 *
 * `undefined` during SSR and hydration, before PostHog answers, when the flag
 * has no payload for this visitor, and when the payload fails `schema`. A
 * payload that fails is reported to Sentry: PostHog stores payloads as
 * unchecked JSON, so a bad edit there would otherwise just make whatever reads
 * it disappear.
 */
const useFeatureFlagPayload = <S extends Schema>(
  flag: FeatureFlags,
  schema: S,
): InferType<S> | undefined => {
  /**
   * The snapshot is the payload as a JSON string, not the payload object:
   * useSyncExternalStore re-renders whenever the snapshot is not Object.is
   * equal to the last one, and equal strings always are.
   */
  const json = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(posthog.getFeatureFlagPayload(flag)),
    () => undefined,
  )
  const parsed = useMemo((): Parsed<InferType<S>> | undefined => {
    if (json === undefined || json === "null") return undefined
    try {
      return {
        value: schema.validateSync(JSON.parse(json), { stripUnknown: true }),
      }
    } catch (error) {
      return { error }
    }
  }, [json, schema])

  useEffect(() => {
    if (parsed?.error === undefined) return
    Sentry.captureException(parsed.error, {
      tags: { feature_flag: flag },
      extra: { payload: json },
    })
  }, [parsed, flag, json])

  return parsed?.value
}

export { useFeatureFlagPayload }
