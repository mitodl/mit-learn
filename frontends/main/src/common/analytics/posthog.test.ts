import type { PostHog } from "posthog-js"

jest.mock("@/env", () => ({
  env: jest.fn(),
}))

import { env } from "@/env"

const mockEnv = jest.mocked(env)

/**
 * Each test gets a fresh module so the module-level _posthog variable is
 * not shared between cases (e.g. a registered instance must not leak into
 * the unregistered test).
 */
const getModule = () => {
  let mod: typeof import("./posthog")
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("./posthog") as typeof import("./posthog")
  })
  return mod!
}

const makeMockPostHog = () => ({ capture: jest.fn() }) as unknown as PostHog

describe("capturePostHog / initPostHog", () => {
  beforeEach(() => {
    mockEnv.mockReset()
  })

  test("does not capture before initPostHog is called", () => {
    mockEnv.mockReturnValue("test-key")
    const { capturePostHog } = getModule()
    const instance = makeMockPostHog()

    capturePostHog("test-event", { foo: "bar" })

    expect(instance.capture).not.toHaveBeenCalled()
  })

  test("does not capture when NEXT_PUBLIC_POSTHOG_API_KEY is not set", () => {
    mockEnv.mockReturnValue(undefined)
    const { capturePostHog, initPostHog } = getModule()
    const instance = makeMockPostHog()
    initPostHog(instance)

    capturePostHog("test-event", { foo: "bar" })

    expect(instance.capture).not.toHaveBeenCalled()
  })

  test("does not capture when NEXT_PUBLIC_POSTHOG_API_KEY is an empty string", () => {
    mockEnv.mockReturnValue("")
    const { capturePostHog, initPostHog } = getModule()
    const instance = makeMockPostHog()
    initPostHog(instance)

    capturePostHog("test-event")

    expect(instance.capture).not.toHaveBeenCalled()
  })

  test("forwards event name and properties after registration with a key", () => {
    mockEnv.mockReturnValue("test-key")
    const { capturePostHog, initPostHog } = getModule()
    const instance = makeMockPostHog()
    initPostHog(instance)

    capturePostHog("test-event", { value: 42, label: "hello" })

    expect(instance.capture).toHaveBeenCalledExactlyOnceWith("test-event", {
      value: 42,
      label: "hello",
    })
  })

  test("forwards event with no properties", () => {
    mockEnv.mockReturnValue("test-key")
    const { capturePostHog, initPostHog } = getModule()
    const instance = makeMockPostHog()
    initPostHog(instance)

    capturePostHog("test-event")

    expect(instance.capture).toHaveBeenCalledExactlyOnceWith(
      "test-event",
      undefined,
    )
  })
})
