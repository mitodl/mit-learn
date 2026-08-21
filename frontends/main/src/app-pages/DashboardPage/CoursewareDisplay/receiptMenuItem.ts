import { SimpleMenuItem } from "ol-components"
import { receiptView } from "@/common/urls"
import type { OrderIdResolution } from "@/common/mitxonline/useOrderIdForResource"

/**
 * The "Receipt" item for a dashboard card, or null when there is nothing to link
 * to.
 *
 * Whether an order exists is the only thing that decides this. Enrollment mode
 * does not: a refund moves the learner back to audit, and that is exactly when
 * they want the receipt. A learner who reached the verified track without
 * paying — a program purchase can upgrade an audit enrollment without creating
 * an order — has no matching order, so the lookup below already hides the item.
 *
 * The three reasons `orderId` can be null are deliberately not equivalent:
 *
 * - still loading — show nothing yet rather than a link that may not work
 * - lookup failed — we do not know whether a receipt exists, so link to
 *   `resolverHref`, which refetches and shows its own skeleton or 404. Hiding the
 *   item here would make a failing request indistinguishable from "you never paid
 *   for this", and would silently drop Receipt from every card at once.
 * - looked up and found nothing — genuinely no receipt, so hide the item
 */
const getReceiptMenuItem = (
  resolution: OrderIdResolution,
  resolverHref: string,
): SimpleMenuItem | null => {
  if (resolution.isPending) return null

  const href =
    resolution.orderId !== null
      ? receiptView(resolution.orderId)
      : resolution.isError
        ? resolverHref
        : null

  if (href === null) return null

  return {
    className: "dashboard-card-menu-item",
    key: "receipt",
    label: "Receipt",
    href,
  }
}

export { getReceiptMenuItem }
