import * as u from "./utils"

describe("formatDurationClockTime", () => {
  it("Correctly formats the duration to a human readable string", () => {
    expect(u.formatDurationClockTime("PT1H23M3S")).toBe("1:23:03")
    expect(u.formatDurationClockTime("PT1H3M3S")).toBe("1:03:03")
    expect(u.formatDurationClockTime("PT45M7S")).toBe("45:07")
    expect(u.formatDurationClockTime("PT6M21S")).toBe("6:21")
    expect(u.formatDurationClockTime("PT44S")).toBe("0:44")
  })
})
