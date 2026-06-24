import moment from "moment"
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

describe("formatDurationHuman", () => {
  it("formats hours and minutes", () => {
    expect(u.formatDurationHuman("PT8H24M")).toBe("8h 24m")
  })

  it("formats hours only when no minutes", () => {
    expect(u.formatDurationHuman("PT1H")).toBe("1h")
  })

  it("formats minutes only when less than an hour", () => {
    expect(u.formatDurationHuman("PT45M")).toBe("45m")
  })

  it("returns empty string for zero duration", () => {
    expect(u.formatDurationHuman("PT0S")).toBe("")
  })
})

describe("formatCalendarDays", () => {
  const FAKE_NOW = "2024-01-15T12:00:00Z"

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(FAKE_NOW))
    setDefaultTimezone("UTC")
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("returns 'Today' for 0", () => {
    expect(u.formatCalendarDays(0)).toBe("Today")
  })

  it("returns 'Tomorrow' / 'Yesterday' for ±1", () => {
    expect(u.formatCalendarDays(1)).toBe("Tomorrow")
    expect(u.formatCalendarDays(-1)).toBe("Yesterday")
  })

  it("returns relative strings for values within ±90 days", () => {
    expect(u.formatCalendarDays(5)).toBe("in 5 days")
    expect(u.formatCalendarDays(90)).toBe("in 90 days")
    expect(u.formatCalendarDays(-5)).toBe("5 days ago")
    expect(u.formatCalendarDays(-90)).toBe("90 days ago")
  })

  it("returns a short Intl-formatted date for abs > 90 days in the future", () => {
    const days = 100
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const expected = Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
      moment(FAKE_NOW).add(days, "days").toDate(),
    )
    expect(u.formatCalendarDays(days)).toBe(expected)
  })

  it("returns a short Intl-formatted date for abs > 90 days in the past", () => {
    const days = -100
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const expected = Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(
      moment(FAKE_NOW).add(days, "days").toDate(),
    )
    expect(u.formatCalendarDays(days)).toBe(expected)
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
