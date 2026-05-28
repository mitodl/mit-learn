import { configureApiClients } from "api/runtime"
import { bootstrapApiClients } from "./api"

jest.mock("api/runtime", () => ({
  configureApiClients: jest.fn(),
}))

const originalEnv = process.env
const originalWindow = global.window

describe("bootstrapApiClients", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_MITOL_API_BASE_URL: "https://learn.public.example.edu",
      NEXT_SERVER_MITOL_API_BASE_URL: "http://learn.internal:8063",
      NEXT_PUBLIC_CSRF_COOKIE_NAME: "csrftoken",
      NEXT_PUBLIC_MITX_ONLINE_BASE_URL: "https://mitx.example.edu",
      NEXT_PUBLIC_MITX_ONLINE_CSRF_COOKIE_NAME: "mitxcsrftoken",
      NEXT_PUBLIC_MITOL_AXIOS_WITH_CREDENTIALS: "true",
    }
    Object.defineProperty(global, "window", {
      configurable: true,
      value: originalWindow,
      writable: true,
    })
  })

  afterAll(() => {
    process.env = originalEnv
    Object.defineProperty(global, "window", {
      configurable: true,
      value: originalWindow,
      writable: true,
    })
  })

  test("uses the server Learn URL when window is absent", () => {
    Object.defineProperty(global, "window", {
      configurable: true,
      value: undefined,
      writable: true,
    })

    try {
      bootstrapApiClients()

      expect(configureApiClients).toHaveBeenCalledWith(
        expect.objectContaining({
          learn: expect.objectContaining({
            baseUrl: "http://learn.internal:8063",
          }),
        }),
      )
    } finally {
      Object.defineProperty(global, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      })
    }
  })

  test("uses the browser Learn URL when window exists", () => {
    bootstrapApiClients()

    expect(configureApiClients).toHaveBeenCalledWith(
      expect.objectContaining({
        learn: expect.objectContaining({
          baseUrl: "https://learn.public.example.edu",
        }),
      }),
    )
  })
})
