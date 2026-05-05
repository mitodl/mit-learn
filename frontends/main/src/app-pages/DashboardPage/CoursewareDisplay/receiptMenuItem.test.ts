import { getReceiptMenuItem } from "./receiptMenuItem"

describe("getReceiptMenuItem", () => {
  test("returns null when enrollment mode is undefined", () => {
    const menuItem = getReceiptMenuItem(
      undefined,
      "/orders/receipt/by-program/99/",
    )
    expect(menuItem).toBeNull()
  })
})
