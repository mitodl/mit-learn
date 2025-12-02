import {
  LearningResource,
  LearningResourcePrice,
  LearningResourceRun,
  ResourceTypeEnum,
} from "api"
import getSymbolFromCurrency from "currency-symbol-map"
import moment from "moment"

/*
 * This constant represents the value displayed when a course is free.
 */
const FREE = "Free"

/*
 * This constant represents the value displayed when a course is paid, but the price is not specified.
 */
const PAID = "Paid"

type Prices = {
  /**
   * The price of the course, which can be a number or a range of numbers.
   * If the course is free, the value is 0. If the course is paid, the value is "Paid".
   *
   * @type {null | LearningResourcePrice[] | typeof PAID}
   * @memberof Prices
   */
  course: null | LearningResourcePrice[] | typeof PAID
  /**
   * The price of the certificate, which can be a number or a range of numbers.
   *
   * @type {null | number[]}
   * @memberof Prices
   */
  certificate: null | LearningResourcePrice[]
}

const getPrices = (prices: LearningResourcePrice[]) => {
  const sortedNonzero = prices
    .sort(
      (a: LearningResourcePrice, b: LearningResourcePrice) =>
        Number(a.amount) - Number(b.amount),
    )
    .filter((price: LearningResourcePrice) => Number(price.amount) > 0)
  const priceRange = sortedNonzero.filter(
    (price, index, arr) => index === 0 || index === arr.length - 1,
  )
  return priceRange.length > 0 ? priceRange : null
}

const getResourcePrices = (resource: LearningResource): Prices => {
  const prices = resource.resource_prices
    ? getPrices(resource.resource_prices)
    : []

  if (resource.free) {
    return resource.certification
      ? { course: [{ amount: "0", currency: "USD" }], certificate: prices }
      : { course: [{ amount: "0", currency: "USD" }], certificate: null }
  }
  return {
    course: prices ?? PAID,
    certificate: null,
  }
}

export const getRunPrices = (run: LearningResourceRun): Prices => {
  const prices = run.resource_prices ? getPrices(run.resource_prices) : []

  return {
    course: prices ?? PAID,
    certificate: null,
  }
}

const getDisplayPrecision = (price: number) => {
  if (Number.isInteger(price)) {
    return price.toFixed(0)
  }
  return price.toFixed(2)
}

export const getDisplayPrice = (
  price: Prices["course"] | Prices["certificate"],
) => {
  if (price === null) {
    return null
  }
  if (price === PAID) {
    return PAID
  }
  if (price.length > 1) {
    return `${getCurrencySymbol(price[0].currency)}${getDisplayPrecision(Number(price[0].amount))} – ${getCurrencySymbol(price[0].currency)}${getDisplayPrecision(Number(price[1].amount))}`
  } else if (price.length === 1) {
    if (Number(price[0].amount) === 0) {
      return FREE
    }
    return `${getCurrencySymbol(price[0].currency)}${getDisplayPrecision(Number(price[0].amount))}`
  }
  return null
}

export const getLearningResourcePrices = (resource: LearningResource) => {
  const prices = getResourcePrices(resource)
  return {
    course: {
      value: prices.course,
      display: getDisplayPrice(prices.course),
    },
    certificate: {
      value: prices.certificate,
      display: getDisplayPrice(prices.certificate),
    },
  }
}

export const showStartAnytime = (resource: LearningResource) => {
  return (
    resource.availability === "anytime" &&
    (
      [ResourceTypeEnum.Course, ResourceTypeEnum.Program] as ResourceTypeEnum[]
    ).includes(resource.resource_type)
  )
}

/**
 * Gets the best start date for a learning resource based on best_run_id.
 * Returns the max of start_date and enrollment_start from the best run.
 * Returns null if best_run_id is null, run not found, or both dates are null.
 */
export const getBestResourceStartDate = (
  resource: LearningResource,
): string | null => {
  const bestRun = resource.runs?.find((run) => run.id === resource.best_run_id)
  if (!bestRun) return null

  if (!bestRun.start_date && !bestRun.enrollment_start) return null

  let bestStart: string
  if (bestRun.start_date && bestRun.enrollment_start) {
    bestStart =
      Date.parse(bestRun.start_date) > Date.parse(bestRun.enrollment_start)
        ? bestRun.start_date
        : bestRun.enrollment_start
  } else {
    bestStart = (bestRun.start_date || bestRun.enrollment_start)!
  }

  const currentDate = moment()
  const bestStartMoment = moment(bestStart)

  return bestStartMoment.isAfter(currentDate)
    ? bestStart
    : currentDate.toISOString()
}

export const getCurrencySymbol = (currencyCode: string) => {
  const symbol = getSymbolFromCurrency(currencyCode) ?? "$"
  // Some currency symbols are just chars (like CHF). In that case,
  // append a space to separate the symbol from the amount.
  return !symbol.match(/^[0-9A-Za-z]+$/) ? symbol : `${symbol} `
}
