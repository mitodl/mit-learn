const bootstrapApiClients = jest.fn()

jest.mock("./bootstrap/api", () => ({
  bootstrapApiClients,
}))

jest.mock("@sentry/nextjs", () => ({
  init: jest.fn(),
  browserTracingIntegration: jest.fn(() => "browserTracingIntegration"),
  browserProfilingIntegration: jest.fn(() => "browserProfilingIntegration"),
  captureRouterTransitionStart: jest.fn(),
}))

jest.mock("./sentry-utils", () => ({
  parseSampleRate: jest.fn((_value, fallback) => fallback),
}))

describe("instrumentation-client", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  test("bootstraps API clients at module load", () => {
    jest.isolateModules(() => {
      // jest.isolateModules takes a sync callback; require is the only way
      // to load a module synchronously inside it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./instrumentation-client")
    })

    expect(bootstrapApiClients).toHaveBeenCalledTimes(1)
  })
})
