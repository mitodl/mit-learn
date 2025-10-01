const hasPosition = <T extends { position: number | null }>(
  r: T,
): r is T & { position: number } => r.position !== null

const shuffle = ([...arr]) => {
  let m = arr.length
  while (m) {
    const i = Math.floor(Math.random() * m--)
    ;[arr[m], arr[i]] = [arr[i], arr[m]]
  }
  return arr
}

/**
 * Randomize a group of ordered items, where item positions might be duplicated.
 * Ordering is preserved between groups, but randomized within groups.
 *
 * E.g., given the items
 *  [
 *  { id: 1, position: 1 },
 *  { id: 2, position: 1 },
 *  { id: 3, position: 2 },
 *  { id: 4, position: 3 },
 *  { id: 5, position: 3 },
 *  { id: 6, position: 3 },
 * ]
 *
 * The results would be:
 * [
 *   ...items with position 1 in random order...,
 *   ...items with position 2 in random order...,
 *   ...items with position 3 in random order...
 * ]
 */
const randomizeGroups = <T extends { position: number }>(results: T[]): T[] => {
  const resultsByPosition: {
    [position: string]: T[] | undefined
  } = {}
  const randomizedResults: T[] = []
  results.forEach((result) => {
    const pos = result?.position
    if (!resultsByPosition[pos]) {
      resultsByPosition[pos] = []
    }
    resultsByPosition[pos]?.push(result)
  })
  Object.keys(resultsByPosition)
    .sort(
      (a, b) => Number(a) - Number(b), // Sort positions numerically
    )
    .forEach((position) => {
      const shuffled = shuffle(resultsByPosition[position] ?? [])
      randomizedResults.push(...shuffled)
    })
  return randomizedResults
}

export { randomizeGroups, hasPosition }
