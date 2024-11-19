import validateRequestParams from "./validateRequestParams"

describe("SearchDisplay validateRequestParams", () => {
  test("Single values are converted to arrays", async () => {
    expect(
      validateRequestParams({
        certification_type: "completion",
        platform: "mitxonline",
      }),
    ).toStrictEqual({
      certification_type: ["completion"],
      platform: ["mitxonline"],
    })
  })

  test("Single string values are preserved", async () => {
    expect(
      validateRequestParams({
        q: "search string",
      }),
    ).toStrictEqual({
      q: "search string",
    })
  })

  test("Booleans strings are converted or removed", async () => {
    expect(
      validateRequestParams({
        free: "true",
        professional: "false",
        certification: undefined,
      }),
    ).toStrictEqual({
      free: true,
      professional: false,
    })
  })

  test("Values are filtered to enums", async () => {
    expect(
      validateRequestParams({
        platform: ["ocw", "xpro", "not a platform"],
      }),
    ).toStrictEqual({
      platform: ["ocw", "xpro"],
    })
  })
})
