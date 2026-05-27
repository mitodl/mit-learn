import learnAxios from "../axios"
import mitxAxios from "../mitxonline/axios"
import { basketsApi } from "../mitxonline/clients"
import { setMockResponse } from "../test-utils/mockAxios"
import {
  configureApiClients,
  getApiClientsConfig,
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

  test("stores normalized config and allows equivalent reconfiguration", () => {
    configureApiClients(makeConfig())
    configureApiClients({
      ...makeConfig(),
      learn: { ...makeConfig().learn, baseUrl: "https://learn.example.edu/" },
    })

    expect(getApiClientsConfig()).toEqual(makeConfig())
    expect(learnAxios.defaults.baseURL).toBe("https://learn.example.edu")
    expect(mitxAxios.defaults.baseURL).toBe("https://mitx.example.edu")
  })

  test("returns frozen config so callers cannot mutate runtime state", () => {
    const config = configureApiClients(makeConfig())

    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.learn)).toBe(true)
    expect(Object.isFrozen(config.mitxonline)).toBe(true)
    expect(
      Reflect.set(config.learn, "baseUrl", "https://other.learn.example.edu"),
    ).toBe(false)
    expect(
      Reflect.set(
        config.mitxonline,
        "csrfCookieName",
        "different-mitxcsrftoken",
      ),
    ).toBe(false)
    expect(getApiClientsConfig()).toEqual(makeConfig())
    expect(learnAxios.defaults.baseURL).toBe("https://learn.example.edu")
    expect(mitxAxios.defaults.baseURL).toBe("https://mitx.example.edu")
  })

  test("rejects invalid config before mutating either axios singleton", async () => {
    const invalidConfig = {
      learn: makeConfig().learn,
      mitxonline: {
        ...makeConfig().mitxonline,
        withCredentials: undefined,
      },
    } as unknown as Parameters<typeof configureApiClients>[0]

    expect(() => configureApiClients(invalidConfig)).toThrow(
      /mitxonline withCredentials must be a boolean/i,
    )
    expect(() => getApiClientsConfig()).toThrow(/configureApiClients/)
    expect(learnAxios.defaults.baseURL).toBeUndefined()
    expect(mitxAxios.defaults.baseURL).toBeUndefined()
    await expect(learnAxios.get("/api/v1/learning_resources/")).rejects.toThrow(
      /configureApiClients/,
    )
    await expect(mitxAxios.get("/api/v0/baskets/")).rejects.toThrow(
      /configureApiClients/,
    )
  })

  test("rejects slash-only baseUrl after normalization before mutating axios", () => {
    const invalidConfig = {
      ...makeConfig(),
      learn: {
        ...makeConfig().learn,
        baseUrl: "/",
      },
    }

    expect(() => configureApiClients(invalidConfig)).toThrow(
      /learn baseUrl is required/i,
    )
    expect(() => getApiClientsConfig()).toThrow(/configureApiClients/)
    expect(learnAxios.defaults.baseURL).toBeUndefined()
    expect(mitxAxios.defaults.baseURL).toBeUndefined()
  })

  test("rejects configs missing a required backend object", () => {
    const invalidConfig = {
      learn: makeConfig().learn,
    } as unknown as Parameters<typeof configureApiClients>[0]

    expect(() => configureApiClients(invalidConfig)).toThrow(
      /mitxonline configuration is required/i,
    )
    expect(() => getApiClientsConfig()).toThrow(/configureApiClients/)
    expect(learnAxios.defaults.baseURL).toBeUndefined()
    expect(mitxAxios.defaults.baseURL).toBeUndefined()
  })

  test("throws on conflicting reconfiguration", () => {
    configureApiClients(makeConfig())

    expect(() =>
      configureApiClients({
        ...makeConfig(),
        learn: {
          ...makeConfig().learn,
          baseUrl: "https://other.learn.example.edu",
        },
      }),
    ).toThrow(/conflicting/i)
  })

  test("reset restores the unconfigured state", async () => {
    configureApiClients(makeConfig())

    resetApiClientsForTests()

    expect(() => getApiClientsConfig()).toThrow(/configureApiClients/)
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
