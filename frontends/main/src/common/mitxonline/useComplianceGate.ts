import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { useQueryClient } from "@tanstack/react-query"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { JustInTimeDialog } from "@/page-components/EnrollmentDialogs/JustInTimeDialog"
import { needsComplianceInfo } from "@/page-components/EnrollmentDialogs/complianceFields"

/**
 * Gate for actions MITx Online rejects without a complete profile — enrolling
 * and adding a product to the basket both require the export-compliance (OFAC)
 * fields, and MIT separately requires a year of birth.
 *
 * `ensureCompliance()` resolves `true` when the action may proceed, either
 * because nothing was missing or because the user just filled it in. It
 * resolves `false` when they dismissed the dialog, in which case the caller
 * should abandon the action **silently** — a cancel is not an error, so callers
 * must not surface a failure message for it.
 *
 * Paid and checkout paths are gated centrally inside `useReplaceBasketItem`;
 * free and verified-program enrollments call this directly, because the
 * `useMutation` contract has no way to express "cancelled" that does not either
 * reject (which reads as a failure to the caller) or resolve as if the
 * enrollment had happened.
 */
const useComplianceGate = () => {
  const queryClient = useQueryClient()

  const ensureCompliance = React.useCallback(async (): Promise<boolean> => {
    let user
    try {
      // Fetched on demand rather than subscribed to, so merely rendering an
      // enroll button costs no request, and the compliance state backing the
      // decision is read at the moment the user acts on it.
      user = await queryClient.fetchQuery(mitxUserQueries.me())
    } catch {
      // Without a definitive answer, don't stand between the user and the
      // action: MITx Online remains the authority and will reject the
      // enrollment itself if the profile really is incomplete.
      return true
    }
    if (!needsComplianceInfo(user)) return true
    return (await NiceModal.show(JustInTimeDialog)) === true
  }, [queryClient])

  return { ensureCompliance }
}

export { useComplianceGate }
