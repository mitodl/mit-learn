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
  test("returns null when enrollment mode is undefined", () => {
    expect(
      getReceiptMenuItem(undefined, resolution({ orderId: 87 }), RESOLVER_HREF),
    ).toBeNull()
  })

  test("returns null for audit enrollments, since auditing is free", () => {
    expect(
      getReceiptMenuItem("audit", resolution({ orderId: 87 }), RESOLVER_HREF),
    ).toBeNull()
  })

  test("returns null while the order lookup is still pending", () => {
    expect(
      getReceiptMenuItem(
        "verified",
        resolution({ isPending: true }),
        RESOLVER_HREF,
      ),
    ).toBeNull()
  })

  test("links straight to the resolved receipt", () => {
    expect(
      getReceiptMenuItem(
        "verified",
        resolution({ orderId: 87 }),
        RESOLVER_HREF,
      ),
    ).toEqual(
      expect.objectContaining({
        key: "receipt",
        label: "Receipt",
        href: "/receipt/87",
      }),
    )
  })

  /**
   * The lookup succeeded and found nothing — e.g. verified via a program purchase
   * that upgraded an existing audit enrollment, which creates no order.
   */
  test("hides the item when the lookup found no order", () => {
    expect(
      getReceiptMenuItem("verified", resolution(), RESOLVER_HREF),
    ).toBeNull()
  })

  /**
   * A failed lookup must not look like "no receipt", or an `orders/history` outage
   * would silently drop Receipt from every card at once. Link to the resolver
   * route, which refetches and renders its own skeleton or 404.
   */
  test("falls back to the resolver route when the lookup failed", () => {
    expect(
      getReceiptMenuItem(
        "verified",
        resolution({ isError: true }),
        RESOLVER_HREF,
      ),
    ).toEqual(
      expect.objectContaining({
        key: "receipt",
        label: "Receipt",
        href: RESOLVER_HREF,
      }),
    )
  })
})
