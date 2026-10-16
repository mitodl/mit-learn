import type { PostHog } from "posthog-js"
import { env } from "@/env"

let _posthog: PostHog | undefined

export const initPostHog = (instance: PostHog) => {
  _posthog = instance
}

export const capturePostHog = (
  event: string,
  properties?: Record<string, unknown>,
) => {
  if (!_posthog || !env("NEXT_PUBLIC_POSTHOG_API_KEY")) return
  _posthog.capture(event, properties)
}
