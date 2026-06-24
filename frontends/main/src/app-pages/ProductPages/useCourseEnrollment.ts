import React from "react"
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
import { PostHogEvents } from "@/common/constants"
import { trackCourseEnrolled } from "@/common/analytics/gtm"
import { env } from "@/env"
import { DASHBOARD_HOME } from "@/common/urls"
import { getCourseScenario, type CourseScenario } from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"

// "free" covers every non-paid enrollment — active audit ("Start Learning") and
// the degraded archived/deadline-passed audit ("Access Course Materials"). They
// hit the same free-enrollment path; only the button label differs.
export type EnrollActionKind = "paid" | "free"

export type EnrollAction = {
  kind: EnrollActionKind
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

// Discriminated — "enrolled" is the collapse state, not an "option"; "none" = no button.
export type EnrollAreaState =
  | { status: "enrolled"; href: string }
  | { status: "options"; options: EnrollAction[] }
  | { status: "none" }

export type UseCourseEnrollment = {
  state: EnrollAreaState
  scenario: CourseScenario
  isStatusLoading: boolean
  isPending: boolean
  isError: boolean
}

export const useCourseEnrollment = (
  course: CourseWithCourseRunsSerializerV2,
  selectedRun: CourseRunV2 | undefined,
  opts?: { onRequireSignup?: (anchor: HTMLButtonElement) => void },
): UseCourseEnrollment => {
  const me = useQuery({
    ...userQueries.me(),
    throwOnError: false,
  })
  const isAuthenticated = !!me.data?.is_authenticated

  const {
    runIds: enrolledRunIds,
    isLoading: enrollmentsIsLoading,
    isError: enrollmentsIsError,
  } = useCourseEnrolledRunIds(course)

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
  const isError =
    replaceBasketItem.isError || createEnrollment.isError || enrollmentsIsError

  const firePostHog = (label: string) => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.CallToActionClicked, {
        readableId: course.readable_id,
        resourceType: "course",
        label,
      })
    }
  }

  const makeOnClick =
    (kind: EnrollActionKind, label: string): EnrollAction["onClick"] =>
    (e) => {
      firePostHog(label)
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
