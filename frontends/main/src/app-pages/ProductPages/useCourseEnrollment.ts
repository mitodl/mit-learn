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
import { env } from "@/env"
import { DASHBOARD_HOME } from "@/common/urls"
import { getCourseScenario, type CourseScenarioKind } from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"

export type EnrollActionKind = "paid" | "free" | "access"

export type EnrollAction = {
  kind: EnrollActionKind
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled: boolean
}

// Discriminated — "enrolled" is the collapse state, not an "option"; "none" = no button.
export type EnrollAreaState =
  | { status: "enrolled"; href: string }
  | { status: "options"; options: EnrollAction[] }
  | { status: "none" }

export type UseCourseEnrollment = {
  state: EnrollAreaState
  scenario: CourseScenarioKind
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
      // "access" kind — no action needed (archive access link; rendered as ButtonLink by consumer)
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

  // Map scenario to EnrollAreaState
  let state: EnrollAreaState
  switch (scenario) {
    case "both":
      state = {
        status: "options",
        options: [
          {
            kind: "paid",
            label: "Earn Certificate",
            onClick: makeOnClick("paid", "Earn Certificate"),
            disabled: isPending,
          },
          {
            kind: "free",
            label: "Start Learning",
            onClick: makeOnClick("free", "Start Learning"),
            disabled: isPending,
          },
        ],
      }
      break
    case "paidOnly":
      state = {
        status: "options",
        options: [
          {
            kind: "paid",
            label: "Enroll",
            onClick: makeOnClick("paid", "Enroll"),
            disabled: isPending,
          },
        ],
      }
      break
    case "freeOnly":
      state = {
        status: "options",
        options: [
          {
            kind: "free",
            label: "Start Learning",
            onClick: makeOnClick("free", "Start Learning"),
            disabled: isPending,
          },
        ],
      }
      break
    case "deadlinePassed":
      state = {
        status: "options",
        options: [
          {
            kind: "free",
            label: "Start Learning",
            onClick: makeOnClick("free", "Start Learning"),
            disabled: isPending,
          },
        ],
      }
      break
    case "archived":
      state = {
        status: "options",
        options: [
          {
            kind: "access",
            label: "Access Course Materials",
            onClick: makeOnClick("access", "Access Course Materials"),
            disabled: isPending,
          },
        ],
      }
      break
    case "none":
    default:
      state = { status: "none" }
      break
  }

  return {
    state,
    scenario,
    isStatusLoading,
    isPending,
    isError,
  }
}
