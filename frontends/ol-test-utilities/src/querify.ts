/**
 * Returns a query string from an object.
 *
 * For example:
 * ```ts
 * querify(undefined) // ""
 * querify({}) // ""
 * querify({ a: 1 }) // "?a=1"
 * querify({ a: 1, b: 2 }) // "?a=1&b=2"
 * querify({ a: 1, b: [2, 3] }) // "?a=1&b=2&b=3"
 * ```
 *
 * The query string is sorted by key.
 */
const queryify = (params: unknown, { explode = true } = {}) => {
  if (!params || Object.keys(params).length === 0) return ""
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (explode) {
        value.forEach((v) => query.append(key, String(v)))
      } else {
        query.append(key, value.join(","))
      }
    } else {
      query.append(key, String(value))
    }
  }
  query.sort()
  const stringified = query.toString()
  return stringified ? `?${stringified}` : ""
}

export { queryify }
