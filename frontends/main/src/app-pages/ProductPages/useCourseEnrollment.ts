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
import { usePostHog } from "posthog-js/react"
import { trackCourseEnrolled } from "@/common/analytics/gtm"
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
      if (!me.data?.is_authenticated) {
        opts?.onRequireSignup?.(e.currentTarget)
        return
      }
      if (kind === "paid") {
        const product = selectedRun?.products?.[0]
        if (product) {
          replaceBasketItem.mutate(product.id)
        }
      } else if (kind === "free") {
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
