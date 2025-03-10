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

describe("getTimeUntil", () => {
  afterEach(() => {
    jest.useRealTimers()
    setDefaultTimezone("UTC")
  })

  it("Correctly formats the time until the given date", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2023-08-03T21:45:00Z"))

    setDefaultTimezone("UTC")
    expect(u.getTimeUntil("2023-08-03T22:45:00Z")).toEqual({
      ms: 3_600_000,
      isToday: true,
      isTomorrow: false,
      days: expect.closeTo(0.042),
    })
    expect(u.getTimeUntil("2023-08-04T01:45:00Z")).toEqual({
      ms: 14_400_000,
      isToday: false,
      isTomorrow: true,
      days: expect.closeTo(0.1666),
    })
    expect(u.getTimeUntil("2023-08-06T01:45:00Z")).toEqual({
      ms: 187_200_000,
      isToday: false,
      isTomorrow: false,
      days: expect.closeTo(2.1666),
    })

    setDefaultTimezone("EST")
    expect(u.getTimeUntil("2023-08-03T22:45:00Z")).toEqual({
      ms: 3_600_000,
      isToday: true,
      isTomorrow: false,
      days: expect.closeTo(0.042),
    })
    expect(u.getTimeUntil("2023-08-04T01:45:00Z")).toEqual({
      ms: 14_400_000,
      isToday: true,
      isTomorrow: false,
      days: expect.closeTo(0.1666),
    })
    expect(u.getTimeUntil("2023-08-06T01:45:00Z")).toEqual({
      ms: 187_200_000,
      isToday: false,
      isTomorrow: false,
      days: expect.closeTo(2.1666),
    })
  })
})
