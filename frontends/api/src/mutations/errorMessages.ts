/**
 * Reading user-facing copy out of an API error response.
 *
 * Our backends answer a rejected-but-well-formed request with a DRF
 * `400 {"detail": "..."}` whose string is written for the learner ("Unable to
 * complete enrollment. Please contact support. Error code: CS_700"). That is
 * strictly better copy than a generic client-side fallback, so call sites that
 * opt in prefer it and fall back to their own string otherwise.
 *
 * The status check is the whole safety story: a 400 is the server deliberately
 * explaining what is wrong with this request, which is safe to show. A 500's
 * `detail` is an internal failure and must never reach a user.
 */

import type { AxiosError } from "axios"

const BAD_REQUEST = 400

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/**
 * The user-facing `detail` from a 400 response body, or `undefined` for
 * anything else: a non-axios error, a network error with no response, any
 * status but 400, a body that is not a plain object (an HTML error page from a
 * proxy), or a `detail` that is missing, blank, or not a string.
 *
 * Returns `undefined` rather than a fallback so each call site owns its own
 * copy via `?? FALLBACK`, and so two candidate errors compose as
 * `badRequestDetail(a) ?? badRequestDetail(b) ?? FALLBACK`.
 *
 * Never throws — it is called inside the global mutation-error handler, where
 * an exception would swallow the failure entirely.
 */
const badRequestDetail = (error: unknown): string | undefined => {
  // Structural rather than `axios.isAxiosError`, matching the rest of the app
  // (e.g. `getQueryClient`'s retry policy) and keeping the axios import
  // type-only. Optional chaining covers null, undefined, and primitives.
  const response = (error as AxiosError | undefined)?.response
  if (response?.status !== BAD_REQUEST) return undefined

  const data: unknown = response.data
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined
  }

  const detail: unknown = (data as { detail?: unknown }).detail
  if (nonEmpty(detail)) return detail.trim()
  // DRF renders `ValidationError(["a", "b"])` as a list of ErrorDetail strings.
  if (Array.isArray(detail)) {
    const joined = detail
      .filter(nonEmpty)
      .map((message) => message.trim())
      .join(" ")
    return joined === "" ? undefined : joined
  }
  return undefined
}

/**
 * Builds a `MutationErrorMeta["getErrorMessage"]`: the 400 detail, else
 * `fallback`.
 *
 * The default `""` is deliberate. A blank string fails the global handler's
 * message check, so the toast falls through to `meta.errorMessage` and then the
 * generic copy — letting a mutation opt into detail-reading without restating
 * copy that already lives elsewhere.
 */
const badRequestDetailOr =
  (fallback = "") =>
  (error: unknown): string =>
    badRequestDetail(error) ?? fallback

export { badRequestDetail, badRequestDetailOr }
