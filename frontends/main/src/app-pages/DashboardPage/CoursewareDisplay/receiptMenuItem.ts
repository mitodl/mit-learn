import { SimpleMenuItem } from "ol-components"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { receiptView } from "@/common/urls"

/**
 * The "Receipt" item for a dashboard card, or null when there is nothing to link
 * to.
 *
 * Verified track alone is not enough — a program purchase can upgrade an existing
 * audit enrollment without creating any order, leaving no receipt. `orderId` is
 * also null while the lookup is pending, so the item appears only once an order is
 * confirmed.
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
    href: receiptView(orderId),
  }
}

export { getReceiptMenuItem }
