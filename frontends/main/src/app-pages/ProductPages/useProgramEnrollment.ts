import { useQuery } from "@tanstack/react-query"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { userQueries } from "api/hooks/user"
import { useCreateProgramEnrollment } from "api/mitxonline-hooks/enrollment"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import { useComplianceGate } from "@/common/mitxonline/useComplianceGate"
import { enrollmentAlertSuccessUrl } from "@/common/mitxonline"
import { useRouter } from "next-nprogress-bar"
import { usePostHog } from "posthog-js/react"
import { trackProgramEnrolled } from "@/common/analytics/gtm"
import { programView } from "@/common/urls"
import { fireEnrollCta, type EnrollCtaPlacement } from "./enrollAnalytics"
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
  tracking: { placement: EnrollCtaPlacement }
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

  // This area renders its own inline enrollment-failure alert (see
  // EnrollOfferingBoxes `isError`), so suppress the global error toast.
  const replaceBasketItem = useReplaceBasketItem({ meta: SILENCE_ERROR_TOAST })
  const createProgramEnrollment = useCreateProgramEnrollment({
    meta: SILENCE_ERROR_TOAST,
  })
  const router = useRouter()
  const posthog = usePostHog()
  // Paid enrollments are gated inside useReplaceBasketItem; the free track
  // calls the enrollment endpoint directly and so gates here.
  const { ensureCompliance } = useComplianceGate()

  const offering = getProgramOffering(program)

  // isStatusLoading: true until we know auth state and (if authed) enrollments
  const isStatusLoading =
    me.isLoading || (isAuthenticated && enrollmentsIsLoading)

  const isPending =
    replaceBasketItem.isPending || createProgramEnrollment.isPending
  const isError = replaceBasketItem.isError || createProgramEnrollment.isError

  const makeOnClick =
    (kind: EnrollActionKind, label: string): EnrollAction["onClick"] =>
    async (e) => {
      // Same event as the course hook; `resourceType: "program"` distinguishes
      // program CTA clicks (including program-as-course display).
      fireEnrollCta(posthog, {
        placement: opts?.tracking.placement,
        kind,
        label,
        resourceType: "program",
        readableId: program.readable_id,
      })
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
        if (!(await ensureCompliance())) return
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
