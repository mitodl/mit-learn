/**
 * Returns `true` if and only if the value is not `null` or `undefined`.
 */
const isNotNil = <T>(x: T): x is NonNullable<T> => {
  if (x === null || x === undefined) return false
  return true
}

type MaybeHasKeys<K extends string> = Partial<Record<K, unknown>>
/**
 * A curried predicate `propNames => obj => boolean`. Primarily useful because
 * the returned function `obj => boolean` is a Typescript Predicate that can
 * be used to filter arrays. For example:
 *
 * ```ts
 * type A = { a: number }
 * const maybes = [{ a: 1 }, {}, { a: undefined }]
 * const definitelies: A[] = maybes.filter(propsNotNil(["a"]))
 * ```
 */
export const propsNotNil = <P extends string>(propNames: P[]) => {
  return <T extends MaybeHasKeys<P>>(
    obj: NonNullable<T>,
  ): obj is T & { [k in P]: NonNullable<T[k]> } => {
    return propNames.every((prop) => isNotNil(obj[prop]))
  }
}
