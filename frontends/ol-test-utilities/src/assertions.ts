import { screen } from "@testing-library/react"
/**
 * This is the library that @testing-library uses to compute accessible names.
 */
import { computeAccessibleName } from "dom-accessibility-api"

type HeadingSpec = {
  level: number
  /**
   * The accessible name of the heading.
   * Can be a matcher like `expect.stringContaining("foo")`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any
}
export const assertHeadings = (
  expected: HeadingSpec[],
  opts?: {
    // inclusive
    maxLevel: number
  },
) => {
  const headings = screen.getAllByRole("heading")
  const actual = headings
    .map((heading) => {
      const level = parseInt(
        heading.getAttribute("aria-level") ?? heading.tagName[1],
        10,
      )
      const name = computeAccessibleName(heading)
      return { level, name }
    })
    .filter(({ level }) => (opts?.maxLevel ? level <= opts.maxLevel : true))
  expect(actual).toEqual(expected)
}
