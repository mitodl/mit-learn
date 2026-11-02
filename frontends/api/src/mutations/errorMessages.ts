/**
 * User-facing copy from an API error. Only a 400 `detail` is safe to show; a
 * 500's is an internal failure.
 */

import type { AxiosError } from "axios"

const BAD_REQUEST = 400

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/** A 400 response's body as an object, or `undefined` for anything else. */
const badRequestBody = (
  error: unknown,
): Record<string, unknown> | undefined => {
  // Structural rather than `axios.isAxiosError`, keeping the import type-only.
  const response = (error as AxiosError | undefined)?.response
  if (response?.status !== BAD_REQUEST) return undefined

  const data: unknown = response.data
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return undefined
  }
  return data as Record<string, unknown>
}

/**
 * The `detail` string from a 400 response body, or `undefined` for anything
 * else. Never throws; call sites supply their own copy via `?? FALLBACK`.
 */
const badRequestDetail = (error: unknown): string | undefined => {
  const detail = badRequestBody(error)?.detail
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
 * The profile fields a 400 says to fix, from its `missing_fields`, or `[]`.
 *
 * MITx Online sends these when an enrollment is blocked by profile data the
 * export compliance check can't use - e.g. a last name CyberSource rejects -
 * using the same field names as `compliance_missing_fields`.
 */
const badRequestMissingFields = (error: unknown): string[] => {
  const fields = badRequestBody(error)?.missing_fields
  return Array.isArray(fields) ? fields.filter(nonEmpty) : []
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

/**
 * The `reason_code` a 400 carries (e.g. `CS_701`), or `undefined`.
 *
 * MITx Online returns its support code here as well as inside `detail`, so
 * callers can match it exactly instead of parsing the message.
 */
const badRequestReasonCode = (error: unknown): string | undefined => {
  const code = badRequestBody(error)?.reason_code
  return nonEmpty(code) ? code : undefined
}

export {
  badRequestDetail,
  badRequestDetailOr,
  badRequestMissingFields,
  badRequestReasonCode,
}
