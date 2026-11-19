import type { PostHog } from "posthog-js"

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    featureFlags: {
      reloadFeatureFlagsAsync: jest.fn(() =>
        Promise.resolve({ status: "loaded" }),
      ),
    },
  },
}))
jest.mock("@/common/analytics/posthog", () => ({ initPostHog: jest.fn() }))

/**
 * Each test gets fresh modules, so the first load one test starts doesn't
 * leak into the next.
 */
type Modules = typeof import("./posthog") & {
  posthog: jest.Mocked<PostHog>
  analytics: jest.Mocked<typeof import("@/common/analytics/posthog")>
}
const getModules = () => {
  let modules: Modules | undefined
  jest.isolateModules(() => {
    modules = {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ...(require("./posthog") as typeof import("./posthog")),
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      posthog: require("posthog-js").default,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      analytics: require("@/common/analytics/posthog"),
    }
  })
  return modules!
}

describe("bootstrapPostHog", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "test-key"
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    jest.restoreAllMocks()
  })

  test("Initializes posthog without a bootstrap, then requests flags", () => {
    const { bootstrapPostHog, getFirstFlagLoad, posthog, analytics } =
      getModules()
    const reload = jest.mocked(posthog.featureFlags.reloadFeatureFlagsAsync)
    bootstrapPostHog()
    expect(posthog.init).toHaveBeenCalledExactlyOnceWith(
      "test-key",
      expect.objectContaining({
        defaults: "2025-05-24",
        remote_config_refresh_interval_ms: 0,
        feature_flag_request_max_retries: 0,
        cross_subdomain_cookie: false,
      }),
    )
    expect(posthog.init.mock.calls[0][1]).not.toHaveProperty("bootstrap")
    expect(analytics.initPostHog).toHaveBeenCalledExactlyOnceWith(posthog)
    expect(reload).toHaveBeenCalledOnce()
    expect(posthog.init.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    )
    expect(getFirstFlagLoad()).toBeInstanceOf(Promise)
  })

  test("Starts posthog once, however often it's called", () => {
    const { bootstrapPostHog, posthog } = getModules()
    bootstrapPostHog()
    bootstrapPostHog()
    expect(posthog.init).toHaveBeenCalledOnce()
    expect(posthog.featureFlags.reloadFeatureFlagsAsync).toHaveBeenCalledOnce()
  })

  test("Doesn't start posthog inside an iframe", () => {
    jest.spyOn(window, "top", "get").mockReturnValue({} as Window)
    const { bootstrapPostHog, getFirstFlagLoad, posthog } = getModules()
    bootstrapPostHog()
    expect(posthog.init).not.toHaveBeenCalled()
    expect(getFirstFlagLoad()).toBeUndefined()
  })

  test("Doesn't start posthog without an api key", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    const { bootstrapPostHog, getFirstFlagLoad, posthog } = getModules()
    bootstrapPostHog()
    expect(posthog.init).not.toHaveBeenCalled()
    expect(getFirstFlagLoad()).toBeUndefined()
  })
})
