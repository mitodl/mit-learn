import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { userQueries } from "api/hooks/user"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { enrollmentAlertSuccessUrl } from "@/common/mitxonline"
import { useRouter } from "next-nprogress-bar"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import {
  trackCourseEnrolled,
  trackStartEnrollment,
  trackBeginCheckout,
} from "@/common/analytics/gtm"
import { DASHBOARD_HOME } from "@/common/urls"
import { getCourseScenario, type CourseScenario } from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"
import { fireEnrollCta, type EnrollCtaPlacement } from "./enrollAnalytics"
import type {
  EnrollAction,
  EnrollActionKind,
  EnrollAreaState,
} from "./enrollTypes"

export type {
  EnrollAction,
  EnrollActionKind,
  EnrollAreaState,
} from "./enrollTypes"

export type UseCourseEnrollment = {
  state: EnrollAreaState
  scenario: CourseScenario
  isStatusLoading: boolean
  isPending: boolean
  isError: boolean
}

type UseCourseEnrollmentOptions = {
  /** Analytics-only metadata for the `enroll_cta_clicked` event; no behavior. */
  tracking: { placement: EnrollCtaPlacement }
  /** Behavioral: called when an unauthenticated user clicks an enroll action. */
  onRequireSignup?: (anchor: HTMLButtonElement) => void
}

export const useCourseEnrollment = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | undefined,
  opts?: UseCourseEnrollmentOptions,
): UseCourseEnrollment => {
  const me = useQuery({
    ...userQueries.me(),
    throwOnError: false,
  })
  const isAuthenticated = !!me.data?.is_authenticated

  const { runIds: enrolledRunIds, isLoading: enrollmentsIsLoading } =
    useCourseEnrolledRunIds(course)

  const replaceBasketItem = useReplaceBasketItem()
  const createEnrollment = useCreateEnrollment()
  const router = useRouter()
  const posthog = usePostHog()
  const anonymousCheckoutEnabled = useFeatureFlagEnabled(
    FeatureFlags.AnonymousCheckout,
  )

  const isEnrolledInSelected =
    selectedRun !== undefined && enrolledRunIds.includes(selectedRun.id)

  const scenario = getCourseScenario(selectedRun)

  // isStatusLoading: true until we know auth state and (if authed) enrollments
  const isStatusLoading =
    me.isLoading || (isAuthenticated && enrollmentsIsLoading)

  const isPending = replaceBasketItem.isPending || createEnrollment.isPending
  // Only enrollment *actions* (basket / create) surface the error alert. A
  // failure to load the user's enrolled-run list is not an action failure, so
  // it degrades silently (user is treated as not-enrolled) rather than showing
  // a misleading "problem processing your enrollment" message.
  const isError = replaceBasketItem.isError || createEnrollment.isError

  const makeOnClick =
    (kind: EnrollActionKind, label: string): EnrollAction["onClick"] =>
    (e) => {
      fireEnrollCta(posthog, {
        placement: opts?.tracking.placement,
        kind,
        label,
        resourceType: "course",
        readableId: course.readable_id,
      })
      // The free/audit track always requires an account. The paid track
      // hands off to the (anonymous-capable) MITx Online basket regardless of
      // auth state, but only once the anonymous-checkout flag is on - until
      // then, anonymous paid clicks fall back to the signup gate too.
      if (
        !me.data?.is_authenticated &&
        (kind === "free" || !anonymousCheckoutEnabled)
      ) {
        opts?.onRequireSignup?.(e.currentTarget)
        return
      }
      trackStartEnrollment(course.title)
      if (kind === "paid") {
        // Paid checkout runs for anonymous users too. The basket and cart live
        // on MITx Online, which supports anonymous baskets, so we hand off
        // directly to checkout and defer account creation to the MITx Online
        // flow (Review → Account → Verify → Payment).
        const product = selectedRun?.products?.[0]
        if (product) {
          trackBeginCheckout(course.title)
          replaceBasketItem.mutate(product.id)
        }
      } else if (kind === "free") {
        // Free enrollment requires an account — there is no anonymous audit
        // enrollment — so unauthenticated users are routed to signup first
        // (handled by the guard above).
        if (selectedRun) {
          createEnrollment.mutate(
            { run_id: selectedRun.id },
            {
              onSuccess: () => {
                trackCourseEnrolled(course.title)
                router.push(
                  enrollmentAlertSuccessUrl({
                    title: course.title ?? "your enrollment",
                  }),
                )
              },
            },
          )
        }
      }
    }

  // Enrolled in the selected run — supersedes everything
  if (isEnrolledInSelected) {
    return {
      state: { status: "enrolled", href: DASHBOARD_HOME },
      scenario,
      isStatusLoading,
      isPending,
      isError,
    }
  }

  // Build the enroll options from the run's offering. The paid and free tracks
  // are independent; labels depend on the offering ("Earn Certificate" when a
  // free track sits alongside, else "Enroll") and the status ("Start Learning"
  // when active, "Access Course Materials" for a degraded/archived run).
  const { status, offering } = scenario
  const options: EnrollAction[] = []
  if (offering === "paid" || offering === "both") {
    const label = offering === "both" ? "Earn Certificate" : "Enroll"
    options.push({
      kind: "paid",
      label,
      onClick: makeOnClick("paid", label),
    })
  }
  if (offering === "free" || offering === "both") {
    const label =
      status === "active" ? "Start Learning" : "Access Course Materials"
    options.push({
      kind: "free",
      label,
      onClick: makeOnClick("free", label),
    })
  }
  // offering "none" (no run, or paid-only past its deadline) yields no options.
  const state: EnrollAreaState = options.length
    ? { status: "options", options }
    : { status: "none" }

  return {
    state,
    scenario,
    isStatusLoading,
    isPending,
    isError,
  }
}
