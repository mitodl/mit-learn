import { SimpleMenuItem } from "ol-components"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { receiptView } from "@/common/urls"

/**
 * The "Receipt" item for a dashboard card's context menu, or null when there is
 * no receipt to show.
 *
 * Two conditions have to hold, and they are not the same thing:
 *
 * 1. The enrollment is on the verified track. Auditing is free, so an audit
 *    enrollment has no transaction to receipt.
 * 2. An order actually paid for *this* run/program. MITx Online also marks runs
 *    verified when the learner bought the enclosing program
 *    (`upgrade_audit_run_enrollments_for_program_purchase`), redeemed a B2B
 *    enrollment code, or was upgraded administratively. None of those create a
 *    run-level `PaidCourseRun`, so there is no run receipt and MITx Online's own
 *    `ReceiptByRunView` 404s. Showing the item in that case is a dead link.
 *
 * `orderId` comes from `useOrderIdForRun` / `useOrderIdForProgram`, which is also
 * null while the order history is still loading — so the item appears once the
 * lookup resolves rather than flashing a link that might not work.
 */
const getReceiptMenuItem = (
  enrollmentMode: string | null | undefined,
  orderId: number | null,
): SimpleMenuItem | null => {
  if (!enrollmentMode || !isVerifiedEnrollmentMode(enrollmentMode)) return null
  if (orderId === null) return null

  return {
    className: "dashboard-card-menu-item",
    key: "receipt",
    label: "Receipt",
    // Links straight to the resolved receipt — no `by-run` redirect hop, since
    // the order id is already in hand.
    href: receiptView(orderId),
  }
}

export { getReceiptMenuItem }
