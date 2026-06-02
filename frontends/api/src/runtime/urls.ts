/**
 * Strip the origin from a paginated `next` URL, returning just `path + search`
 * so the request rides the configured axios `baseURL` instead of the host the
 * backend put in `next`. The backend has been observed to emit the wrong port
 * in `next` for RC/PROD; see https://github.com/mitodl/hq/issues/10999.
 *
 * The placeholder base only satisfies the `URL` constructor for already-relative
 * inputs; it never appears in the output.
 */
export const toRelativeApiUrl = (url: string) => {
  const parsed = new URL(url, "https://placeholder.invalid")
  return `${parsed.pathname}${parsed.search}`
}
