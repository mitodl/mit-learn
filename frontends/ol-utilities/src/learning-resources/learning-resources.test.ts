import { allRunsAreIdentical, findBestRun } from "./learning-resources"
import * as factories from "api/test-utils/factories"
import { faker } from "@faker-js/faker/locale/en"
import { CourseResourceDeliveryInnerCodeEnum } from "api"

const makeRun = factories.learningResources.run
const fromNow = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const { shuffle } = faker.helpers

describe("findBestRun", () => {
  const future = makeRun({
    start_date: fromNow(5),
    end_date: fromNow(30),
    title: "future",
  })
  const farFuture = makeRun({
    start_date: fromNow(50),
    end_date: fromNow(80),
    title: "farFuture",
  })
  const past = makeRun({
    start_date: fromNow(-30),
    end_date: fromNow(-5),
    title: "past",
  })
  const farPast = makeRun({
    start_date: fromNow(-70),
    end_date: fromNow(-60),
    title: "farPast",
  })
  const current1 = makeRun({
    start_date: fromNow(-5),
    end_date: fromNow(10),
    title: "current1",
  })
  const current2 = makeRun({
    start_date: fromNow(-10),
    end_date: fromNow(5),
    title: "current2",
  })
  const undated = makeRun({
    start_date: null,
    end_date: null,
    title: "undated",
  })

  it("returns undefined if no runs", () => {
    expect(findBestRun([])).toBeUndefined()
  })

  it("Picks current run if available", () => {
    const runs = [past, current1, current2, future, farFuture, undated]
    const expected = current1
    const actual = findBestRun(shuffle(runs))
    expect(actual).toEqual(expected)
  })

  it("Picks future if no current runs", () => {
    const runs = [farPast, past, future, farFuture, undated]
    const expected = future
    const actual = findBestRun(shuffle(runs))
    expect(actual).toEqual(expected)
  })

  it("Picks recent past if no future or current", () => {
    const runs = [past, farPast, undated]
    const expected = past
    const actual = findBestRun(shuffle(runs))
    expect(actual).toEqual(expected)
  })

  test("undated OK as last resort", () => {
    const runs = [undated]
    const expected = undated
    const actual = findBestRun(shuffle(runs))
    expect(actual).toEqual(expected)
  })
})

describe("allRunsAreIdentical", () => {
  test("returns true if no runs", () => {
    const resource = factories.learningResources.resource()
    resource.runs = []
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns true if only one run", () => {
    const resource = factories.learningResources.resource()
    resource.runs = [makeRun()]
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns true if all runs are identical", () => {
    const resource = factories.learningResources.resource()
    const startDate = new Date().toISOString().split("T")[0]
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        start_date: startDate,
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        start_date: startDate,
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        start_date: startDate,
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(true)
  })

  test("returns false if prices differ", () => {
    const resource = factories.learningResources.resource()
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: [{ amount: "150", currency: "USD" }],
        delivery: delivery,
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })

  test("returns false if delivery methods differ", () => {
    const resource = factories.learningResources.resource()
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: [
          { code: CourseResourceDeliveryInnerCodeEnum.Online, name: "Online" },
        ],
        location: location,
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })

  test("returns false if locations differ", () => {
    const resource = factories.learningResources.resource()
    const prices = [{ amount: "100", currency: "USD" }]
    const delivery = [
      { code: CourseResourceDeliveryInnerCodeEnum.InPerson, name: "In person" },
    ]
    const location = "New York"
    resource.runs = [
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: location,
      }),
      makeRun({
        resource_prices: prices,
        delivery: delivery,
        location: "San Francisco",
      }),
    ]
    expect(allRunsAreIdentical(resource)).toBe(false)
  })
})
