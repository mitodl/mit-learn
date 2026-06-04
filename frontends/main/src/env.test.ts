import { env, requiredEnv } from "@/env"

test("env() reads from window.__ENV", () => {
  window.__ENV = { NEXT_PUBLIC_ORIGIN: "https://example.test" }
  expect(env("NEXT_PUBLIC_ORIGIN")).toBe("https://example.test")
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
