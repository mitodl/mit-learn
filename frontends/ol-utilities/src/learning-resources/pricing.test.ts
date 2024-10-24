import { factories } from "api/test-utils"
import { getLearningResourcePrices } from "./pricing"

describe("getLearningResourcePrices", () => {
  it("free course with no certificate", async () => {
    const resource = factories.learningResources.resource({
      free: true,
      certification: false,
      resource_prices: [{ amount: "0", currency: "USD" }],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "0", currency: "USD" }], display: "Free" },
      certificate: { value: null, display: null },
    })
  })

  it("free course with certificate", async () => {
    const resource = factories.learningResources.resource({
      free: true,
      certification: true,
      resource_prices: [
        { amount: "0", currency: "USD" },
        { amount: "49", currency: "USD" },
      ],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "0", currency: "USD" }], display: "Free" },
      certificate: {
        value: [{ amount: "49", currency: "USD" }],
        display: "$49",
      },
    })
  })

  it("free course with certificate range", async () => {
    const resource = factories.learningResources.resource({
      free: true,
      certification: true,
      resource_prices: [
        { amount: "0", currency: "USD" },
        { amount: "99", currency: "USD" },
        { amount: "49", currency: "USD" },
      ],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "0", currency: "USD" }], display: "Free" },
      certificate: {
        value: [
          { amount: "49", currency: "USD" },
          { amount: "99", currency: "USD" },
        ],
        display: "$49 – $99",
      },
    })
  })

  it("paid course without certificate", async () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: false,
      resource_prices: [{ amount: "49", currency: "USD" }],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "49", currency: "USD" }], display: "$49" },
      certificate: { value: null, display: null },
    })
  })

  it("paid course with certificate", async () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: true,
      resource_prices: [{ amount: "49", currency: "USD" }],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "49", currency: "USD" }], display: "$49" },
      certificate: { value: null, display: null },
    })
  })

  it("paid course with bad currency code should default to $", async () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: true,
      resource_prices: [{ amount: "49", currency: "YYY" }],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: { value: [{ amount: "49", currency: "YYY" }], display: "$49" },
      certificate: { value: null, display: null },
    })
  })

  it("paid course with certificate range and Euro currency", async () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: true,
      resource_prices: [
        { amount: "49", currency: "EUR" },
        { amount: "99", currency: "EUR" },
      ],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: {
        value: [
          { amount: "49", currency: "EUR" },
          { amount: "99", currency: "EUR" },
        ],
        display: "€49 – €99",
      },
      certificate: { value: null, display: null },
    })
  })

  it("paid course with certificate range and ETB currency", async () => {
    const resource = factories.learningResources.resource({
      free: false,
      certification: true,
      resource_prices: [
        { amount: "49", currency: "ETB" },
        { amount: "99", currency: "ETB" },
      ],
    })
    expect(getLearningResourcePrices(resource)).toEqual({
      course: {
        value: [
          { amount: "49", currency: "ETB" },
          { amount: "99", currency: "ETB" },
        ],
        display: "Br 49 – Br 99",
      },
      certificate: { value: null, display: null },
    })
  })
})
