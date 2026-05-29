import learnAxios from "../axios"
import mitxAxios from "../mitxonline/axios"
import { basketsApi } from "../mitxonline/clients"
import { setMockResponse } from "../test-utils/mockAxios"
import {
  configureApiClients,
  isApiClientsConfigured,
  resetApiClientsForTests,
} from "./index"

const makeConfig = () => ({
  learn: {
    baseUrl: "https://learn.example.edu",
    csrfCookieName: "csrftoken",
    withCredentials: true,
  },
  mitxonline: {
    baseUrl: "https://mitx.example.edu",
    csrfCookieName: "mitxcsrftoken",
    withCredentials: false,
  },
})

describe("api runtime configuration", () => {
  beforeEach(() => resetApiClientsForTests())

  test("rejects Learn and MITx requests before configuration", async () => {
    await expect(learnAxios.get("/api/v1/learning_resources/")).rejects.toThrow(
      /configureApiClients/,
    )
    await expect(mitxAxios.get("/api/v0/baskets/")).rejects.toThrow(
      /configureApiClients/,
    )
    await expect(basketsApi.basketsCheckoutRetrieve()).rejects.toThrow(
      /configureApiClients/,
    )
  })

  test("normalizes baseUrl and applies the full config to the axios singletons", () => {
    configureApiClients({
      ...makeConfig(),
      learn: { ...makeConfig().learn, baseUrl: "https://learn.example.edu/" },
    })

    expect(learnAxios.defaults.baseURL).toBe("https://learn.example.edu")
    expect(learnAxios.defaults.xsrfCookieName).toBe("csrftoken")
    expect(learnAxios.defaults.withCredentials).toBe(true)

    expect(mitxAxios.defaults.baseURL).toBe("https://mitx.example.edu")
    expect(mitxAxios.defaults.xsrfCookieName).toBe("mitxcsrftoken")
    expect(mitxAxios.defaults.withCredentials).toBe(false)
  })

  test("isApiClientsConfigured reflects configuration state", () => {
    expect(isApiClientsConfigured()).toBe(false)
    configureApiClients(makeConfig())
    expect(isApiClientsConfigured()).toBe(true)
    resetApiClientsForTests()
    expect(isApiClientsConfigured()).toBe(false)
  })

  test("rejects slash-only baseUrl as invalid during normalization before mutating axios", () => {
    const invalidConfig = {
      ...makeConfig(),
      learn: {
        ...makeConfig().learn,
        baseUrl: "/",
      },
    }

    expect(() => configureApiClients(invalidConfig)).toThrow(
      /learn baseUrl is invalid after normalization/i,
    )
    expect(isApiClientsConfigured()).toBe(false)
    expect(learnAxios.defaults.baseURL).toBeUndefined()
    expect(mitxAxios.defaults.baseURL).toBeUndefined()
  })

  test("throws when configureApiClients is called more than once", () => {
    configureApiClients(makeConfig())

    expect(() => configureApiClients(makeConfig())).toThrow(
      /already configured/i,
    )
  })

  test("reset restores the unconfigured state", async () => {
    configureApiClients(makeConfig())

    resetApiClientsForTests()

    expect(isApiClientsConfigured()).toBe(false)
    expect(learnAxios.defaults.baseURL).toBeUndefined()
    expect(mitxAxios.defaults.baseURL).toBeUndefined()
    await expect(learnAxios.get("/api/v1/learning_resources/")).rejects.toThrow(
      /configureApiClients/,
    )
    await expect(mitxAxios.get("/api/v0/baskets/")).rejects.toThrow(
      /configureApiClients/,
    )
  })

  test("MITx generated clients use the configured singleton axios instance", async () => {
    configureApiClients(makeConfig())
    setMockResponse.get("https://mitx.example.edu/api/v0/baskets/checkout/", {
      ok: true,
    })

    const response = await basketsApi.basketsCheckoutRetrieve()

    expect(response.data).toEqual({ ok: true })
  })
})
