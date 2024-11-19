import { getRequestParams } from "./getSearchParams"

describe("SearchDisplay getRequestParams", () => {
  test("Single values are converted to arrays", async () => {
    expect(
      getRequestParams({
        certification_type: "completion",
        platform: "mitxonline",
      }),
    ).toStrictEqual({
      certification_type: ["completion"],
      platform: ["mitxonline"],
    })
  })

  test("Booleans strings are converted or removed", async () => {
    expect(
      getRequestParams({
        free: "true",
        professional: "false",
        certification: undefined,
      }),
    ).toStrictEqual({
      free: true,
      professional: false,
    })
  })
})
