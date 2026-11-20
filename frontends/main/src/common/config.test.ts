import { getCacheSMaxageSeconds, getSupportShareStoryUrl } from "./config"

describe("getSupportShareStoryUrl", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test("returns the configured URL, trimmed", () => {
    process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL =
      " https://forms.example.com/story \n"
    expect(getSupportShareStoryUrl()).toBe("https://forms.example.com/story")
  })

  test.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "  "],
  ])("returns undefined when %s", (_label, value) => {
    if (value !== undefined) {
      process.env.NEXT_PUBLIC_SUPPORT_SHARE_STORY_URL = value
    }
    expect(getSupportShareStoryUrl()).toBeUndefined()
  })
})

describe("getCacheSMaxageSeconds", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  test("reads the configured TTL", () => {
    process.env.NEXT_PUBLIC_CACHE_S_MAXAGE_SECONDS = "7200"
    expect(getCacheSMaxageSeconds()).toBe(7200)
  })

  test("falls back when unset, as in local dev and the CI stack", () => {
    expect(getCacheSMaxageSeconds()).toBe(1800)
  })

  // ol-infrastructure sends "" when the Pulumi config key is absent, so the
  // fallback must not treat it as the number 0.
  test("falls back when empty", () => {
    process.env.NEXT_PUBLIC_CACHE_S_MAXAGE_SECONDS = ""
    expect(getCacheSMaxageSeconds()).toBe(1800)
  })

  // Distinct from empty, which Number() also turns into 0.
  test("honors an explicit 0", () => {
    process.env.NEXT_PUBLIC_CACHE_S_MAXAGE_SECONDS = "0"
    expect(getCacheSMaxageSeconds()).toBe(0)
  })
})
