export {}

const originalEnv = process.env

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

describe("Learn generated clients", () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test("do not derive runtime base paths from NEXT_PUBLIC_MITOL_API_BASE_URL", async () => {
    process.env.NEXT_PUBLIC_MITOL_API_BASE_URL = "https://env.example.edu"

    const { configureApiClients, resetApiClientsForTests } = await import(
      "./runtime"
    )
    const { BASE_PATH } = await import("./clients")

    resetApiClientsForTests()
    configureApiClients(makeConfig())
    expect(BASE_PATH).toBe("")
  })
})
