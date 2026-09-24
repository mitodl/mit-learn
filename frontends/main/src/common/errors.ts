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

export { ForbiddenError, isForbiddenResponse }
