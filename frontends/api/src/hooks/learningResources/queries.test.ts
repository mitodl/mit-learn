const originalEnv = process.env

describe("learningResourceQueries", () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test("normalizes paginated follow-up requests to a relative URL", async () => {
    process.env.NEXT_PUBLIC_MITOL_API_BASE_URL = "https://env.example.edu"

    const { toRelativeApiUrl } = await import("../../runtime/urls")

    expect(
      toRelativeApiUrl(
        "https://learn.example.edu/api/v1/learning_resources/42/items/?offset=5",
      ),
    ).toBe("/api/v1/learning_resources/42/items/?offset=5")
  })
})
