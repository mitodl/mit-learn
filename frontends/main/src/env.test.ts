import { env, requiredEnv, fullEnv } from "@/env"

test("env() reads from window.__ENV", () => {
  window.__ENV = { NEXT_PUBLIC_ORIGIN: "https://example.test" }
  expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://example.test")
  delete window.__ENV
})

test("env() falls back to the x-public-env <meta> when window.__ENV is unset", () => {
  // The x-public-env <meta> is the primary delivery mechanism for runtime env
  // vars; env() reads it on first access and caches it on window.__ENV.
  const meta = document.createElement("meta")
  meta.setAttribute("name", "x-public-env")
  meta.setAttribute(
    "content",
    JSON.stringify({ NEXT_PUBLIC_ORIGIN: "https://meta.test" }),
  )
  document.head.appendChild(meta)

  expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://meta.test")
  // cached so later reads skip the DOM query
  expect(window.__ENV).toEqual({ NEXT_PUBLIC_ORIGIN: "https://meta.test" })

  meta.remove()
  delete window.__ENV
})

test("env() ignores a malformed x-public-env <meta> and does not throw", () => {
  const meta = document.createElement("meta")
  meta.setAttribute("name", "x-public-env")
  meta.setAttribute("content", "{not valid json")
  document.head.appendChild(meta)

  expect(() => env("NEXT_PUBLIC_ORIGIN")).not.toThrow()
  expect(window.__ENV).toBeUndefined()

  meta.remove()
})

test("fullEnv() returns the full map, bootstrapping from the <meta> like env()", () => {
  const meta = document.createElement("meta")
  meta.setAttribute("name", "x-public-env")
  meta.setAttribute(
    "content",
    JSON.stringify({
      NEXT_PUBLIC_ORIGIN: "https://meta.test",
      NEXT_PUBLIC_FEATURE_demo: "True",
    }),
  )
  document.head.appendChild(meta)

  expect(fullEnv()).toEqual({
    NEXT_PUBLIC_ORIGIN: "https://meta.test",
    NEXT_PUBLIC_FEATURE_demo: "True",
  })

  meta.remove()
  delete window.__ENV
})

describe("env() while the document is still streaming (error-shell pages)", () => {
  /*
   * On SSR-error responses the x-public-env <meta> streams near the END of the
   * body, but module evaluation (instrumentation-client, module-scope env()
   * captures) can run before the parser reaches it. env() must then fetch the
   * values synchronously from /public-env.json rather than returning undefined
   * or throwing.
   */
  let readyStateSpy: jest.SpyInstance
  const RealXHR = window.XMLHttpRequest

  const mockXhr = (impl: {
    status?: number
    responseText?: string
    throws?: boolean
  }) => {
    const open = jest.fn()
    const send = jest.fn(() => {
      if (impl.throws) throw new Error("network error")
    })
    const instances: Array<{ open: jest.Mock; send: jest.Mock }> = []
    window.XMLHttpRequest = jest.fn(function (this: XMLHttpRequest) {
      Object.assign(this, {
        open,
        send,
        status: impl.status ?? 0,
        responseText: impl.responseText ?? "",
      })
      instances.push({ open, send })
    }) as unknown as typeof XMLHttpRequest
    return { open, send, instances }
  }

  beforeEach(() => {
    readyStateSpy = jest
      .spyOn(document, "readyState", "get")
      .mockReturnValue("loading")
  })

  afterEach(() => {
    readyStateSpy.mockRestore()
    window.XMLHttpRequest = RealXHR
    delete window.__ENV
    jest.resetModules()
  })

  const freshEnv = async () => (await import("@/env")).env

  test("fetches env synchronously from /public-env.json when no <meta> is parsed yet", async () => {
    const { open } = mockXhr({
      status: 200,
      responseText: JSON.stringify({ NEXT_PUBLIC_ORIGIN: "https://xhr.test" }),
    })
    const env = await freshEnv()
    expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://xhr.test")
    // synchronous request to the env route
    expect(open).toHaveBeenCalledWith("GET", "/public-env.json", false)
    // cached for subsequent reads
    expect(window.__ENV).toEqual({ NEXT_PUBLIC_ORIGIN: "https://xhr.test" })
  })

  test("prefers the <meta> when present; no network request", async () => {
    const { send } = mockXhr({ status: 200, responseText: "{}" })
    const meta = document.createElement("meta")
    meta.setAttribute("name", "x-public-env")
    meta.setAttribute(
      "content",
      JSON.stringify({ NEXT_PUBLIC_ORIGIN: "https://meta.test" }),
    )
    document.head.appendChild(meta)

    const env = await freshEnv()
    expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://meta.test")
    expect(send).not.toHaveBeenCalled()
    meta.remove()
  })

  test("a failed fetch does not throw and is not retried", async () => {
    const { send } = mockXhr({ throws: true })
    const env = await freshEnv()
    expect(() => env("NEXT_PUBLIC_ORIGIN")).not.toThrow()
    env("NEXT_PUBLIC_ORIGIN")
    expect(send).toHaveBeenCalledTimes(1)
  })

  test("no fetch once the document has finished parsing", async () => {
    // meta absent + parsing done ⇒ the meta was genuinely never delivered;
    // fall through to the process.env test fallback without a network request.
    readyStateSpy.mockReturnValue("complete")
    const { send } = mockXhr({ status: 200, responseText: "{}" })
    const env = await freshEnv()
    env("NEXT_PUBLIC_ORIGIN")
    expect(send).not.toHaveBeenCalled()
  })
})

/*
 * Compile-time regression guard for env.ts's schema-derived key unions. Never
 * runs; enforced by `yarn typecheck`. If a yup/TS change breaks the InferType
 * derivation, these assertions stop matching and CI fails loudly.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeRegression = () => {
  // @ts-expect-error — key not in the validateEnv schema
  env("NEXT_PUBLIC_NOT_IN_SCHEMA")
  // @ts-expect-error — optional key is not assignable to requiredEnv
  requiredEnv("NEXT_PUBLIC_POSTHOG_API_KEY")
  env("NEXT_PUBLIC_POSTHOG_API_KEY") // valid: optional key OK for env()
  requiredEnv("NEXT_PUBLIC_ORIGIN") // valid: required key OK for requiredEnv()
}
