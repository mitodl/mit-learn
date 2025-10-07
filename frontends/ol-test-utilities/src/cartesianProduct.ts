// Provide several overloads for better type inference with up to 5 arrays.
function cartesianProduct<A, B>(a: A[], b: B[]): (A & B)[]
function cartesianProduct<A, B, C>(a: A[], b: B[], c: C[]): (A & B & C)[]
function cartesianProduct<A, B, C, D>(
  a: A[],
  b: B[],
  c: C[],
  d: D[],
): (A & B & C & D)[]
function cartesianProduct<A, B, C, D, E>(
  a: A[],
  b: B[],
  c: C[],
  d: D[],
  e: E[],
): (A & B & C & D & E)[]
function cartesianProduct<T>(...arrays: T[][]): T[]

/**
 * Generates the cartesian product of multiple arrays of objects, merging the
 * objects. This can be used with jest.each for an effect similar to multiple
 * pytest.mark.parametrize calls.
 *
 * For example:
 * ```ts
 * cartesianProduct(
 *   [{ x: 1 }, { x: 2 }],
 *   [{ y: 'a' }, { y: 'b' }],
 *   [{ z: 3 }, { z: 4 }]
 * )
 * ```
 *
 * would yield:
 * ```
 * [
 *   { x: 1, y: 'a', z: 3 },
 *   { x: 1, y: 'a', z: 4 },
 *   { x: 1, y: 'b', z: 3 },
 *   { x: 1, y: 'b', z: 4 },
 *   { x: 2, y: 'a', z: 3 },
 *   { x: 2, y: 'a', z: 4 },
 *   { x: 2, y: 'b', z: 3 },
 *   { x: 2, y: 'b', z: 4 }
 * ]
 * ```
 */
function cartesianProduct<T extends object>(...arrays: T[][]): T[] {
  return arrays.reduce<T[]>(
    (acc, curr) => {
      return acc.flatMap((a) => curr.map((b) => ({ ...a, ...b })))
    },
    [{}] as T[],
  )
}

export default cartesianProduct
