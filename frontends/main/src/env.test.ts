import { env, requiredEnv, fullEnv } from "@/env"

test("env() reads from window.__ENV", () => {
  window.__ENV = { NEXT_PUBLIC_ORIGIN: "https://example.test" }
  expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://example.test")
  delete window.__ENV
})

test("env() falls back to the x-public-env <meta> when window.__ENV is unset", () => {
  // Error/not-found pages are client-rendered shells where PublicEnvScript never
  // runs; env() must read the value from the <meta> the root layout emits.
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
