import { getReceiptMenuItem } from "./receiptMenuItem"

describe("getReceiptMenuItem", () => {
  test("returns null when enrollment mode is undefined", () => {
    expect(getReceiptMenuItem(undefined, 87)).toBeNull()
  })

  test("returns null for audit enrollments, since auditing is free", () => {
    expect(getReceiptMenuItem("audit", 87)).toBeNull()
  })

  // Also covers "lookup still pending" — the hook reports null for both.
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
