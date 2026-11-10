/**
 * Thrown when we know something is forbidden without having to make a request.
 */
class ForbiddenError extends Error {}

/**
 * Whether a rejected request was refused rather than broken. 401 and 403 are
 * both treated as "not yours to see": the B2B pages reach their data through
 * APISIX, which answers 401 for a session it cannot resolve and 403 for one it
 * can, and either way the reader is shown the same access-denied page.
 */
const isForbiddenResponse = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status
  return status === 401 || status === 403
}

const NOT_LOADED_CODES: unknown[] = [
  "organization_not_loaded",
  "contract_not_loaded",
]

/**
 * Whether the analytics API refused a request because it has no data for the
 * organization or contract yet.
 *
 * MITx Online knows about an organization or contract as soon as it is
 * created, but the warehouse the analytics API reads only picks it up on its
 * next load. Until then the API answers a manager with a 404 whose
 * `detail.code` names what is missing, so the page can say the data is on its
 * way instead of reporting a failure. The org routes only ever answer
 * `organization_not_loaded` and the contract routes `contract_not_loaded`.
 */
const isAnalyticsNotLoaded = (error: unknown): boolean => {
  const response = (
    error as {
      response?: { status?: number; data?: { detail?: { code?: unknown } } }
    } | null
  )?.response
  return (
    response?.status === 404 &&
    NOT_LOADED_CODES.includes(response.data?.detail?.code)
  )
}

export { ForbiddenError, isForbiddenResponse, isAnalyticsNotLoaded }
