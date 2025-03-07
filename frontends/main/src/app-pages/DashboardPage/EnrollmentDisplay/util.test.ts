import { formatTimeUntil } from "./utils"
import moment from "moment"

describe("formatTimeUntil", () => {
  const MOCK_NOW = "2023-08-02T02:13:00Z"
  const momentUtc = moment.utc
  jest.spyOn(moment, "utc").mockImplementation((...args) => {
    if (args.length === 0) {
      return momentUtc(MOCK_NOW)
    }
    return momentUtc(...args)
  })

  it("Correctly formats the time until the given date", () => {
    expect(formatTimeUntil("2023-08-02T02:25:02Z")).toBe("Less than a day")
    expect(formatTimeUntil("2023-08-03T04:38:00Z")).toBe("1 day")
    expect(formatTimeUntil("2023-08-05T04:38:00Z")).toBe("3 days")
    expect(formatTimeUntil("2023-10-05T04:38:00Z")).toBe("64 days")
  })
})
