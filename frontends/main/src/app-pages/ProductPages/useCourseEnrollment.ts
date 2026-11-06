import { useQuery } from "@tanstack/react-query"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { userQueries } from "api/hooks/user"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { useComplianceGate } from "@/common/mitxonline/useComplianceGate"
import { enrollmentAlertSuccessUrl } from "@/common/mitxonline"
import { useRouter } from "next-nprogress-bar"
import { analytics } from "@/common/analytics"
import { DASHBOARD_HOME } from "@/common/urls"
import {
  getCourseScenario,
  getEnrollableRuns,
  type CourseScenario,
} from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"
import { type EnrollCtaPlacement } from "./enrollAnalytics"
import { signupToEnrollUrl, useResumeEnrollment } from "./enrollResume"
import { offers } from "./enrollTypes"
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
  /** The failed enroll *action*'s error, or null. Drives the alert copy. */
  error: unknown
}

type UseCourseEnrollmentOptions = {
  /** Analytics-only metadata for the `enroll_cta_clicked` event; no behavior. */
  tracking: { placement: EnrollCtaPlacement }
  /**
   * Finish an enrollment started before sign-up. Set on one instance per page,
   * so the enrollment runs once.
   */
  resume?: boolean
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

  // This area renders its own inline enrollment-failure alert (see
  // EnrollOfferingBoxes `error`), so suppress the global error toast.
  const replaceBasketItem = useReplaceBasketItem({ meta: SILENCE_ERROR_TOAST })
  const createEnrollment = useCreateEnrollment({ meta: SILENCE_ERROR_TOAST })
  const router = useRouter()
  // Paid enrollments are gated inside useReplaceBasketItem; the free track
  // calls the enrollment endpoint directly and so gates here.
  const { mutateWithCompliance } = useComplianceGate()

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
  const error = replaceBasketItem.error ?? createEnrollment.error

  const startEnrollment = async (
    kind: EnrollActionKind,
    run: CourseRunV2 | undefined,
  ) => {
    analytics.enrollmentStarted(course.title)
    if (kind === "paid") {
      const product = run?.products?.[0]
      if (run && product) {
        analytics.checkoutStarted({
          courseName: course.title,
          courseId: course.readable_id,
          value: product.price ? parseFloat(product.price) : 0,
        })
        replaceBasketItem.mutate(product.id, {
          type: "course_run",
          id: run.id,
        })
      }
    } else if (kind === "free") {
      if (run) {
        await mutateWithCompliance(
          createEnrollment,
          { run_id: run.id },
          {
            onSuccess: () => {
              analytics.courseEnrolled(course.title)
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

  const makeOnClick =
    (kind: EnrollActionKind, label: string): EnrollAction["onClick"] =>
    async () => {
      analytics.enrollCtaClicked({
        placement: opts?.tracking.placement,
        kind,
        resourceType: "course",
        readableId: course.readable_id,
        label,
      })
      if (!me.data?.is_authenticated) {
        window.location.assign(signupToEnrollUrl(kind, selectedRun?.id))
        return
      }
      await startEnrollment(kind, selectedRun)
    }

  useResumeEnrollment({
    enabled: !!opts?.resume,
    ready: !isStatusLoading,
    onResume: (kind, runId) => {
      // The run the learner chose before signing up, while it still makes the
      // same offer and they are not already enrolled in it.
      const run =
        runId === null
          ? selectedRun
          : getEnrollableRuns(course).find((r) => r.id === runId)
      if (!isAuthenticated || !run || enrolledRunIds.includes(run.id)) return
      if (offers(getCourseScenario(run).offering, kind)) {
        startEnrollment(kind, run)
      }
    },
  })

  // Enrolled in the selected run — supersedes everything
  if (isEnrolledInSelected) {
    return {
      state: { status: "enrolled", href: DASHBOARD_HOME },
      scenario,
      isStatusLoading,
      isPending,
      error,
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
    error,
  }
}
