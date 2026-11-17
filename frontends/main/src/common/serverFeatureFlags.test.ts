import { PostHog } from "posthog-node"
import { FeatureFlags } from "./feature_flags"
import { getServerFlags } from "./serverFeatureFlags"

jest.mock("posthog-node", () => ({ PostHog: jest.fn() }))

const makeClient = () => ({
  on: jest.fn(),
  waitForLocalEvaluationReady: jest.fn().mockResolvedValue(true),
  isLocalEvaluationReady: jest.fn().mockReturnValue(true),
  getFeatureFlagResult: jest.fn().mockResolvedValue(undefined),
})

describe("getServerFlags", () => {
  let client: ReturnType<typeof makeClient>

  const setKeys = () => {
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "phc_test"
    process.env.POSTHOG_SECRET_KEY = "phs_test"
  }
  const flagResults = (byKey: Record<string, object>) => {
    client.getFeatureFlagResult.mockImplementation(async (key: string) =>
      key in byKey
        ? { key, variant: undefined, payload: undefined, ...byKey[key] }
        : undefined,
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    client = makeClient()
    jest.mocked(PostHog).mockImplementation(() => client as never)
    jest.spyOn(console, "info").mockImplementation(() => {})
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.POSTHOG_SECRET_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_API_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_API_HOST
    delete process.env.POSTHOG_SERVER_FLAGS_WAIT_MS
    delete process.env.POSTHOG_SERVER_FLAGS_POLLING_INTERVAL_MS
    delete globalThis.__MIT_LEARN_SERVER_FLAGS__
    jest.restoreAllMocks()
  })

  test("Returns {} and creates no client without POSTHOG_SECRET_KEY", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY = "phc_test"
    expect(await getServerFlags()).toEqual({})
    expect(PostHog).not.toHaveBeenCalled()
  })

  test("Keeps one client on globalThis and evaluates each flag locally for the fixed id, sending no events", async () => {
    setKeys()
    process.env.NEXT_PUBLIC_POSTHOG_API_HOST = "https://ph.test"
    await getServerFlags()
    await getServerFlags()
    expect(PostHog).toHaveBeenCalledTimes(1)
    expect(PostHog).toHaveBeenCalledWith("phc_test", {
      host: "https://ph.test",
      secretKey: "phs_test",
      featureFlagsPollingInterval: 300_000,
    })
    expect(globalThis.__MIT_LEARN_SERVER_FLAGS__?.client).toBe(client)
    for (const key of Object.values(FeatureFlags)) {
      expect(client.getFeatureFlagResult).toHaveBeenCalledWith(
        key,
        "mit-learn-nextjs-server",
        { onlyEvaluateLocally: true, sendFeatureFlagEvents: false },
      )
    }
  })

  test("Reads the wait and polling interval from the environment", async () => {
    setKeys()
    process.env.POSTHOG_SERVER_FLAGS_WAIT_MS = "500"
    process.env.POSTHOG_SERVER_FLAGS_POLLING_INTERVAL_MS = "60000"
    await getServerFlags()
    expect(PostHog).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({ featureFlagsPollingInterval: 60_000 }),
    )
    expect(client.waitForLocalEvaluationReady).toHaveBeenCalledWith(500)
  })

  test("Returns the flags PostHog evaluated, leaving out the ones it has no result for", async () => {
    setKeys()
    flagResults({
      "universal-ai": { enabled: true },
      "contact-us": { enabled: false },
    })
    expect(await getServerFlags()).toEqual({
      "universal-ai": true,
      "contact-us": false,
    })
  })

  test("Leaves out a flag that is disabled in PostHog", async () => {
    setKeys()
    flagResults({
      "universal-ai": { enabled: false, reasonCode: "flag_disabled" },
    })
    expect(await getServerFlags()).toEqual({})
  })

  test.each([
    [
      "evaluation throws",
      () => client.getFeatureFlagResult.mockRejectedValue(new Error("boom")),
    ],
    [
      "the client cannot be created",
      () =>
        jest.mocked(PostHog).mockImplementation(() => {
          throw new Error("bad key")
        }),
    ],
  ])("Returns {} when %s", async (_name, arrange) => {
    setKeys()
    arrange()
    expect(await getServerFlags()).toEqual({})
  })

  test("Waits for definitions once per process, and does not evaluate until they load", async () => {
    setKeys()
    client.waitForLocalEvaluationReady.mockResolvedValue(false)
    client.isLocalEvaluationReady.mockReturnValue(false)
    expect(await getServerFlags()).toEqual({})
    expect(await getServerFlags()).toEqual({})
    expect(client.waitForLocalEvaluationReady).toHaveBeenCalledTimes(1)
    expect(client.waitForLocalEvaluationReady).toHaveBeenCalledWith(3000)
    expect(client.getFeatureFlagResult).not.toHaveBeenCalled()
  })

  test("Evaluates once definitions load after the wait gave up", async () => {
    setKeys()
    client.waitForLocalEvaluationReady.mockResolvedValue(false)
    client.isLocalEvaluationReady.mockReturnValue(false)
    await getServerFlags()
    client.isLocalEvaluationReady.mockReturnValue(true)
    flagResults({ "universal-ai": { enabled: true } })
    expect(await getServerFlags()).toEqual({ "universal-ai": true })
  })

  test("Logs errors that posthog-node emits", async () => {
    setKeys()
    await getServerFlags()
    const listener = client.on.mock.calls.find(
      ([event]) => event === "error",
    )?.[1]
    const error = new Error("network down")
    listener(error)
    expect(console.error).toHaveBeenCalledWith("[posthog-node]", error)
  })
})
