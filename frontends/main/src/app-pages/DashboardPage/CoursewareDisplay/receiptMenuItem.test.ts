import { getReceiptMenuItem } from "./receiptMenuItem"
import type { OrderIdResolution } from "@/common/mitxonline/useOrderIdForResource"

const RESOLVER_HREF = "/receipt/by-program/99"

const resolution = (
  overrides: Partial<OrderIdResolution> = {},
): OrderIdResolution => ({
  isPending: false,
  isError: false,
  orderId: null,
  ...overrides,
})

describe("getReceiptMenuItem", () => {
  test("returns null while the order lookup is still pending", () => {
    expect(
      getReceiptMenuItem(resolution({ isPending: true }), RESOLVER_HREF),
    ).toBeNull()
  })

  test("links straight to the resolved receipt", () => {
    expect(
      getReceiptMenuItem(resolution({ orderId: 87 }), RESOLVER_HREF),
    ).toEqual(
      expect.objectContaining({
        key: "receipt",
        label: "Receipt",
        href: "/receipt/87",
      }),
    )
  })

  /**
   * A refund moves the learner back to the audit track, and the receipt is where
   * they see that it came through. Enrollment mode is not consulted at all; the
   * order lookup is the only thing that decides.
   */
  test("still links once the order has been refunded and the learner is auditing", () => {
    expect(
      getReceiptMenuItem(resolution({ orderId: 87 }), RESOLVER_HREF),
    ).toEqual(expect.objectContaining({ href: "/receipt/87" }))
  })

  /**
   * The lookup succeeded and found nothing — e.g. verified via a program purchase
   * that upgraded an existing audit enrollment, which creates no order.
   */
  test("hides the item when the lookup found no order", () => {
    expect(getReceiptMenuItem(resolution(), RESOLVER_HREF)).toBeNull()
  })

  /**
   * A failed lookup must not look like "no receipt", or an `orders/history` outage
   * would silently drop Receipt from every card at once. Link to the resolver
   * route, which refetches and renders its own skeleton or 404.
   */
  test("falls back to the resolver route when the lookup failed", () => {
    expect(
      getReceiptMenuItem(resolution({ isError: true }), RESOLVER_HREF),
    ).toEqual(
      expect.objectContaining({
        key: "receipt",
        label: "Receipt",
        href: RESOLVER_HREF,
      }),
    )
  })
})
