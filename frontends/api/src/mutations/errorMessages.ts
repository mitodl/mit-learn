/**
 * User-facing copy from an API error. Only a 400 `detail` is safe to show; a
 * 500's is an internal failure.
 */

import type { AxiosError } from "axios"

const BAD_REQUEST = 400

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/**
 * The `detail` string from a 400 response body, or `undefined` for anything
 * else. Never throws; call sites supply their own copy via `?? FALLBACK`.
 */
const badRequestDetail = (error: unknown): string | undefined => {
  // Structural rather than `axios.isAxiosError`, keeping the import type-only.
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
 * `fallback`. The default `""` fails the global handler's message check, so the
 * toast falls through to the generic copy.
 */
const badRequestDetailOr =
  (fallback = "") =>
  (error: unknown): string =>
    badRequestDetail(error) ?? fallback

export { badRequestDetail, badRequestDetailOr }
