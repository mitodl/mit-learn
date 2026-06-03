import { configureApiClients, isApiClientsConfigured } from "api/runtime"
import { bootstrapApiClients } from "./api"

jest.mock("api/runtime", () => ({
  configureApiClients: jest.fn(),
  isApiClientsConfigured: jest.fn(() => false),
}))

const originalEnv = process.env

describe("bootstrapApiClients", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_MITOL_API_BASE_URL: "https://learn.public.example.edu",
      NEXT_PUBLIC_CSRF_COOKIE_NAME: "csrftoken",
      NEXT_PUBLIC_MITX_ONLINE_BASE_URL: "https://mitx.example.edu",
      NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME: "mitxcsrftoken",
      NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: "true",
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test("configures learn and mitxonline clients from NEXT_PUBLIC vars", () => {
    bootstrapApiClients()

    expect(configureApiClients).toHaveBeenCalledWith(
      expect.objectContaining({
        learn: expect.objectContaining({
          baseUrl: "https://learn.public.example.edu",
          csrfCookieName: "csrftoken",
          withCredentials: true,
        }),
        mitxonline: expect.objectContaining({
          baseUrl: "https://mitx.example.edu",
          csrfCookieName: "mitxcsrftoken",
          withCredentials: true,
        }),
      }),
    )
  })

  test.each([
    "NEXT_PUBLIC_MITOL_API_BASE_URL",
    "NEXT_PUBLIC_CSRF_COOKIE_NAME",
    "NEXT_PUBLIC_MITX_ONLINE_BASE_URL",
    "NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME",
  ])("throws when %s is missing", (envName) => {
    process.env = { ...process.env }
    delete process.env[envName]

    expect(() => bootstrapApiClients()).toThrow(new RegExp(envName))
    expect(configureApiClients).not.toHaveBeenCalled()
  })

  test("treats NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS values other than true as false", () => {
    process.env = {
      ...process.env,
      NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: "TRUE",
    }

    bootstrapApiClients()

    expect(configureApiClients).toHaveBeenCalledWith(
      expect.objectContaining({
        learn: expect.objectContaining({ withCredentials: false }),
        mitxonline: expect.objectContaining({ withCredentials: false }),
      }),
    )
  })

  test("no-ops when API clients are already configured", () => {
    ;(isApiClientsConfigured as jest.Mock).mockReturnValueOnce(true)

    bootstrapApiClients()

    expect(configureApiClients).not.toHaveBeenCalled()
  })
})
