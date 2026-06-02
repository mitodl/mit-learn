import { toRelativeApiUrl } from "./urls"

describe("toRelativeApiUrl", () => {
  test("strips the origin from an absolute API URL", () => {
    expect(
      toRelativeApiUrl(
        "https://learn.example.edu/api/v1/learning_resources/42/items/?offset=5",
      ),
    ).toBe("/api/v1/learning_resources/42/items/?offset=5")
  })
})
