import {
  LearningResource,
  LearningResourcePrice,
  LearningResourceRun,
  ResourceTypeEnum,
} from "api"
import { findBestRun } from "ol-utilities"
import getSymbolFromCurrency from "currency-symbol-map"

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

export const getResourceDate = (resource: LearningResource): string | null => {
  const startDate =
    resource.next_start_date ?? findBestRun(resource.runs ?? [])?.start_date

  return startDate ?? null
}

export const getCurrencySymbol = (currencyCode: string) => {
  const symbol = getSymbolFromCurrency(currencyCode) ?? "$"
  // Some currency symbols are just chars (like CHF). In that case,
  // append a space to separate the symbol from the amount.
  return !symbol.match(/^[0-9A-Za-z]+$/) ? symbol : `${symbol} `
}
