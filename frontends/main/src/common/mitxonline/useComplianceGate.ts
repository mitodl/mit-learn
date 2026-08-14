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
  // Collapses concurrent callers (e.g. a double-clicked enroll button) onto a
  // single check, so a second click can't slip through and start its own
  // mutation while the first is still awaiting the profile fetch or dialog.
  const inFlight = React.useRef<Promise<boolean> | null>(null)

  const ensureCompliance = React.useCallback((): Promise<boolean> => {
    if (inFlight.current) {
      // A second caller arriving while the first is still in flight (e.g. a
      // double-clicked enroll button) must not also resume once the first
      // resolves true -- only the action that actually initiated the check
      // should proceed, or both fire their own enroll/basket mutation.
      return inFlight.current.then(() => false)
    }

    const promise = (async (): Promise<boolean> => {
      // Defaults to "missing" so a failed check fails closed: with no
      // definitive answer, treat it the same as compliance info being
      // missing rather than letting the action through unchecked.
      let missing = true
      try {
        // Fetched on demand rather than subscribed to, so merely rendering an
        // enroll button costs no request, and the compliance state backing the
        // decision is read at the moment the user acts on it -- staleTime: 0
        // overrides the query client's default so a cached profile from
        // minutes ago can't stand in for a live check.
        const user = await queryClient.fetchQuery({
          ...mitxUserQueries.me(),
          staleTime: 0,
        })
        missing = needsComplianceInfo(user)
      } catch {
        // Swallow the fetch error -- `missing` already defaults to `true`,
        // which routes into the dialog below. The dialog fetches the profile
        // itself and lets the user submit fresh values regardless of why
        // this pre-check failed, so it doubles as the retry surface: a
        // transient failure here just means the dialog opens with blank
        // fields instead of prefilled ones, and a real backend outage
        // surfaces as the dialog's own save-error alert.
      }
      if (!missing) return true
      return (await NiceModal.show(JustInTimeDialog)) === true
    })().finally(() => {
      inFlight.current = null
    })

    inFlight.current = promise
    return promise
  }, [queryClient])

  return { ensureCompliance }
}

export { useComplianceGate }
