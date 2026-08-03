import { getReceiptMenuItem } from "./receiptMenuItem"

describe("getReceiptMenuItem", () => {
  test("returns null when enrollment mode is undefined", () => {
    expect(getReceiptMenuItem(undefined, 87)).toBeNull()
  })

  test("returns null for audit enrollments, since auditing is free", () => {
    expect(getReceiptMenuItem("audit", 87)).toBeNull()
  })

  /**
   * Covers both "no order paid for this run/program" (e.g. verified via a program
   * purchase or B2B code) and "the lookup has not resolved yet" — the hook
   * reports null for both, and hiding the item is correct either way.
   */
  test("returns null for a verified enrollment with no resolved order", () => {
    expect(getReceiptMenuItem("verified", null)).toBeNull()
  })

  test("links straight to the resolved receipt for verified enrollments", () => {
    expect(getReceiptMenuItem("verified", 87)).toEqual(
      expect.objectContaining({
        key: "receipt",
        label: "Receipt",
        href: "/receipt/87",
      }),
    )
  })
})
