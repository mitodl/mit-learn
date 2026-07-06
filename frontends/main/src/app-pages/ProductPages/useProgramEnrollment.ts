import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { PlatformEnum } from "api"
import { userQueries } from "api/hooks/user"
import { useCreateProgramEnrollment } from "api/mitxonline-hooks/enrollment"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { enrollmentAlertSuccessUrl } from "@/common/mitxonline"
import { useRouter } from "next-nprogress-bar"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { trackProgramEnrolled } from "@/common/analytics/gtm"
import { env } from "@/env"
import { programView } from "@/common/urls"
import { getProgramOffering, type ProgramOffering } from "./programOffering"
import { useProgramIsEnrolled } from "./useProgramIsEnrolled"
import type {
  EnrollAction,
  EnrollActionKind,
  EnrollAreaState,
} from "./enrollTypes"

export type UseProgramEnrollment = {
  state: EnrollAreaState
  offering: ProgramOffering
  isStatusLoading: boolean
  isPending: boolean
  isError: boolean
}

type UseProgramEnrollmentOptions = {
  /** Analytics-only metadata for the `enroll_cta_clicked` event; no behavior. */
  tracking: { placement: "header" | "infobox" }
  /** Program-as-course product pages use different button copy. */
  displayAsCourse?: boolean
  /** Behavioral: called when an unauthenticated user clicks an enroll action. */
  onRequireSignup?: (anchor: HTMLButtonElement) => void
}

export const useProgramEnrollment = (
  program: V2ProgramDetail,
  opts?: UseProgramEnrollmentOptions,
): UseProgramEnrollment => {
  const me = useQuery({
    ...userQueries.me(),
    throwOnError: false,
  })
  const isAuthenticated = !!me.data?.is_authenticated

  const { isEnrolled, isLoading: enrollmentsIsLoading } =
    useProgramIsEnrolled(program)

  const replaceBasketItem = useReplaceBasketItem()
  const createProgramEnrollment = useCreateProgramEnrollment()
  const router = useRouter()
  const posthog = usePostHog()

  const offering = getProgramOffering(program)

  // isStatusLoading: true until we know auth state and (if authed) enrollments
  const isStatusLoading =
    me.isLoading || (isAuthenticated && enrollmentsIsLoading)

  const isPending =
    replaceBasketItem.isPending || createProgramEnrollment.isPending
  const isError = replaceBasketItem.isError || createProgramEnrollment.isError

  // Dedicated, semantically-named enrollment event (hq#11941), reused verbatim
  // from the course hook — same event, `resourceType: "program"` distinguishes
  // program CTA clicks (including program-as-course display).
  const firePostHog = (kind: EnrollActionKind, label: string) => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.EnrollCtaClicked, {
        placement: opts?.tracking.placement,
        enrollmentMode: kind === "paid" ? "verified" : "audit",
        resourceType: "program",
        readableId: program.readable_id,
        platform: PlatformEnum.Mitxonline,
        label,
      })
    }
  }

  const makeOnClick =
    (kind: EnrollActionKind, label: string): EnrollAction["onClick"] =>
    (e) => {
      firePostHog(kind, label)
      if (!me.data?.is_authenticated) {
        opts?.onRequireSignup?.(e.currentTarget)
        return
      }
      if (kind === "paid") {
        const product = program.products[0]
        if (product) {
          replaceBasketItem.mutate(product.id)
        }
      } else if (kind === "free") {
        createProgramEnrollment.mutate(
          { V3ProgramEnrollmentRequestRequest: { program_id: program.id } },
          {
            onSuccess: () => {
              trackProgramEnrolled(program.title)
              router.push(
                enrollmentAlertSuccessUrl({
                  title: program.title ?? "your enrollment",
                }),
              )
            },
          },
        )
      }
    }

  // Enrolled — supersedes everything. Same target as today's program button
  // (programView), NOT the course hook's DASHBOARD_HOME — deliberate, UX-confirmed.
  if (isEnrolled) {
    return {
      state: { status: "enrolled", href: programView(program.id) },
      offering,
      isStatusLoading,
      isPending,
      isError,
    }
  }

  // Build the enroll options from the program's offering. The paid and free
  // tracks are independent; labels depend on the offering and displayAsCourse.
  const options: EnrollAction[] = []
  if (offering === "paid" || offering === "both") {
    const label =
      offering === "both"
        ? "Earn Certificate"
        : opts?.displayAsCourse
          ? "Enroll"
          : "Enroll in Program"
    options.push({
      kind: "paid",
      label,
      onClick: makeOnClick("paid", label),
    })
  }
  if (offering === "free" || offering === "both") {
    const label = "Start Learning"
    options.push({
      kind: "free",
      label,
      onClick: makeOnClick("free", label),
    })
  }
  // offering "none" (no purchasable product and no free track) yields no options.
  const state: EnrollAreaState = options.length
    ? { status: "options", options }
    : { status: "none" }

  return {
    state,
    offering,
    isStatusLoading,
    isPending,
    isError,
  }
}
