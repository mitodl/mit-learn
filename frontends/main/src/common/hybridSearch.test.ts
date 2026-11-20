import { FeatureFlags } from "@/common/feature_flags"
import { isHybridSearchEnabled } from "./hybridSearch"

afterEach(() => {
  delete window.__ENV
})

test("The server's disable-hybrid-search flag turns hybrid search off", () => {
  const serverFlags = { [FeatureFlags.DisableHybridSearch]: true }
  expect(isHybridSearchEnabled(new URLSearchParams(), serverFlags)).toBe(false)
})

test("The vector_search URL param wins over the server's flag", () => {
  const serverFlags = { [FeatureFlags.DisableHybridSearch]: true }
  expect(
    isHybridSearchEnabled(
      new URLSearchParams("vector_search=true"),
      serverFlags,
    ),
  ).toBe(true)
})

test("The flag's env default turns hybrid search off when the server has no value", () => {
  window.__ENV = { NEXT_PUBLIC_FEATURE_disable_hybrid_search: "true" }
  expect(isHybridSearchEnabled(new URLSearchParams(), {})).toBe(false)
})
