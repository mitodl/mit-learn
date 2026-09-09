import { AxiosError } from "axios"
import type { AxiosResponse } from "axios"
import { badRequestDetail, badRequestDetailOr } from "./errorMessages"

/** Shaped like the errors `setMockResponse` throws. */
const apiError = (status: number, data: unknown) =>
  new AxiosError("Mock Error", String(status), undefined, undefined, {
    data,
    status,
  } as AxiosResponse)

describe("badRequestDetail", () => {
  test.each([
    {
      desc: "a 400 detail string",
      error: apiError(400, { detail: "Enrollment is closed for this run." }),
      expected: "Enrollment is closed for this run.",
    },
    {
      desc: "a padded 400 detail",
      error: apiError(400, { detail: "  Please contact support.  " }),
      expected: "Please contact support.",
    },
    {
      desc: "a DRF list of ErrorDetail strings",
      error: apiError(400, { detail: ["Enrollment is closed.", "Try later."] }),
      expected: "Enrollment is closed. Try later.",
    },
  ])("returns $desc", ({ error, expected }) => {
    expect(badRequestDetail(error)).toBe(expected)
  })

  test.each([
    {
      desc: "a 500, even with a detail",
      error: apiError(500, { detail: "Boom" }),
    },
    { desc: "a 403 with a detail", error: apiError(403, { detail: "Nope" }) },
    {
      desc: "a 409 with a detail",
      error: apiError(409, { detail: "Conflict" }),
    },
    { desc: "a 400 with no detail key", error: apiError(400, {}) },
    {
      desc: "a 400 with a blank detail",
      error: apiError(400, { detail: "   " }),
    },
    {
      desc: "a 400 with a non-string detail",
      error: apiError(400, { detail: 42 }),
    },
    {
      desc: "a 400 with a null detail",
      error: apiError(400, { detail: null }),
    },
    {
      desc: "a 400 with an object detail",
      error: apiError(400, { detail: { message: "nested" } }),
    },
    {
      desc: "a 400 whose detail list has nothing usable",
      error: apiError(400, { detail: ["", "   "] }),
    },
    {
      desc: "a 400 with DRF field errors rather than a detail",
      error: apiError(400, { run_id: ["This field is required."] }),
    },
    {
      desc: "a 400 with an HTML body",
      error: apiError(400, "<html>oops</html>"),
    },
    { desc: "a 400 with a list body", error: apiError(400, ["nope"]) },
    { desc: "a 400 with a null body", error: apiError(400, null) },
    {
      desc: "a network error with no response",
      error: new AxiosError("Network"),
    },
    { desc: "a plain Error", error: new Error("boom") },
    { desc: "a string", error: "boom" },
    { desc: "null", error: null },
    { desc: "undefined", error: undefined },
  ])("returns undefined for $desc", ({ error }) => {
    expect(badRequestDetail(error)).toBeUndefined()
  })
})

describe("badRequestDetailOr", () => {
  test("prefers the 400 detail over the fallback", () => {
    const getMessage = badRequestDetailOr("Fallback copy.")
    expect(getMessage(apiError(400, { detail: "Server copy." }))).toBe(
      "Server copy.",
    )
  })

  test("uses the fallback for anything but a usable 400 detail", () => {
    const getMessage = badRequestDetailOr("Fallback copy.")
    expect(getMessage(apiError(500, { detail: "Boom" }))).toBe("Fallback copy.")
    expect(getMessage(apiError(400, {}))).toBe("Fallback copy.")
  })

  test("with no fallback, yields an empty string so callers fall through", () => {
    // A blank message fails the global handler's isMessage check.
    const getMessage = badRequestDetailOr()
    expect(getMessage(apiError(500, { detail: "Boom" }))).toBe("")
    expect(getMessage(apiError(400, { detail: "Server copy." }))).toBe(
      "Server copy.",
    )
  })
})
