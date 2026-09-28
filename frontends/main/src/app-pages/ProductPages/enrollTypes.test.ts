import { offeringBoxCount } from "./enrollTypes"

describe("offeringBoxCount", () => {
  test("enrolled -> 1 regardless of offering", () => {
    expect(offeringBoxCount("both", true)).toBe(1)
    expect(offeringBoxCount("none", true)).toBe(1)
  })

  test("both -> 2", () => {
    expect(offeringBoxCount("both", false)).toBe(2)
  })

  test.each(["paid", "free"] as const)("%s -> 1", (offering) => {
    expect(offeringBoxCount(offering, false)).toBe(1)
  })

  test("none -> 0", () => {
    expect(offeringBoxCount("none", false)).toBe(0)
  })
})
