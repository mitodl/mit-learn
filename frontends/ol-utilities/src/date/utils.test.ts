import * as u from "./utils"
import { setDefaultTimezone } from "ol-test-utilities"

describe("formatDurationClockTime", () => {
  it("Correctly formats the duration to a human readable string", () => {
    expect(u.formatDurationClockTime("PT1H23M3S")).toBe("1:23:03")
    expect(u.formatDurationClockTime("PT1H3M3S")).toBe("1:03:03")
    expect(u.formatDurationClockTime("PT45M7S")).toBe("45:07")
    expect(u.formatDurationClockTime("PT6M21S")).toBe("6:21")
    expect(u.formatDurationClockTime("PT44S")).toBe("0:44")
  })
})

describe("calendarDaysUntil", () => {
  test("Gets calendar days until date, respecting timezone", () => {
    //         UTC                       EST
    const f0 = "2023-04-08T22:45:00Z" // 2023-04-08T17:45:00-05:00
    const f1 = "2023-04-08T23:45:00Z" // 2023-04-08T18:45:00-05:00
    const f2 = "2023-04-09T01:45:00Z" // 2023-04-08T20:45:00-05:00
    const f3 = "2023-04-10T01:45:00Z" // 2023-04-09T20:45:00-05:00
    const f4 = "2023-04-11T03:45:00Z" // 2023-04-10T22:45:00-05:00
    const f5 = "2023-06-11T01:45:00Z" // 2023-06-10T20:45:00-05:00
    const p1 = "2023-04-08T01:45:00Z" // 2023-04-07T20:45:00-05:00
    const p2 = "2023-04-07T01:45:00Z" // 2023-04-06T20:45:00-05:00

    jest.useFakeTimers()
    jest.setSystemTime(new Date(f0))

    const dates = [f0, f1, f2, f3, f4, f5, p1, p2]
    setDefaultTimezone("UTC")
    expect(dates.map((date) => u.calendarDaysUntil(date))).toEqual([
      0, 0, 1, 2, 3, 64, 0, -1,
    ])

    setDefaultTimezone("EST")
    expect(dates.map((date) => u.calendarDaysUntil(date))).toEqual([
      0, 0, 0, 1, 2, 63, -1, -2,
    ])
  })
})
