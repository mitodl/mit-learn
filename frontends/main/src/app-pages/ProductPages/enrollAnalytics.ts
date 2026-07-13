import type { PostHog } from "posthog-js"
import { PlatformEnum } from "api"
import { PostHogEvents } from "@/common/constants"
import { env } from "@/env"
import type { EnrollActionKind } from "./enrollTypes"

export type EnrollCtaPlacement = "header" | "infobox"

/**
 * Dedicated, semantically-named enrollment CTA event (hq#11941). Replaces the
 * generic cta_clicked for enroll CTAs so analytics can slice by placement /
 * enrollment_mode instead of the drifting button copy. `label` is retained
 * for human readability, not as the analytics key. One definition — this is
 * the analytics contract for course AND program enroll buttons.
 */
export const fireEnrollCta = (
  posthog: PostHog,
  {
    placement,
    kind,
    label,
    resourceType,
    readableId,
  }: {
    placement: EnrollCtaPlacement | undefined
    kind: EnrollActionKind
    label: string
    resourceType: "course" | "program"
    readableId: string
  },
) => {
  if (!env("NEXT_PUBLIC_POSTHOG_API_KEY")) return
  posthog.capture(PostHogEvents.EnrollCtaClicked, {
    placement,
    enrollmentMode: kind === "paid" ? "verified" : "audit",
    resourceType,
    readableId,
    platform: PlatformEnum.Mitxonline,
    label,
  })
}
