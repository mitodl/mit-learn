import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { useQueryClient } from "@tanstack/react-query"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { JustInTimeDialog } from "@/page-components/EnrollmentDialogs/JustInTimeDialog"
import { needsComplianceInfo } from "@/page-components/EnrollmentDialogs/complianceFields"

/**
 * Holds the single in-flight compliance check for the whole tree.
 *
 * It has to be shared rather than per-hook: a product page has two gate
 * instances (the free-enrollment gate, plus the one inside
 * `useReplaceBasketItem`) and the dashboard has one per card. `NiceModal.show`
 * returns the *same* promise when the dialog is already open, so without
 * sharing, each instance awaits one dialog and each resumes its own mutation
 * from a single submit.
 *
 * A provider rather than module-level state, so the ref cannot outlive the
 * tree. A dialog left unresolved (e.g. a test that opens it and never closes
 * it) leaves the promise pending forever; module state would pin that
 * indefinitely and silently make every later enroll click a no-op.
 */
const ComplianceGateContext =
  React.createContext<React.MutableRefObject<Promise<boolean> | null> | null>(
    null,
  )

const ComplianceGateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const inFlight = React.useRef<Promise<boolean> | null>(null)
  return (
    <ComplianceGateContext.Provider value={inFlight}>
      {children}
    </ComplianceGateContext.Provider>
  )
}

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
  // Collapses concurrent callers (e.g. two dashboard cards clicked before the
  // dialog appears) onto a single check, so a second click can't slip through
  // and start its own mutation while the first is still awaiting the profile
  // fetch or dialog. Falls back to a per-instance ref when no
  // ComplianceGateProvider is mounted, so a gate still works in isolation --
  // it just can't collapse calls from sibling instances.
  const shared = React.useContext(ComplianceGateContext)
  const local = React.useRef<Promise<boolean> | null>(null)
  const inFlight = shared ?? local

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
  }, [queryClient, inFlight])

  return { ensureCompliance }
}

export { useComplianceGate, ComplianceGateProvider }
