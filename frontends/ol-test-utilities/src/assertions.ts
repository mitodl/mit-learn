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
  id?: string
}
export const assertHeadings = (expected: HeadingSpec[]) => {
  const headings = screen.getAllByRole("heading")
  const actual = headings.map((heading, index) => {
    const level = parseInt(heading.tagName[1], 10)
    const name = computeAccessibleName(heading)
    const actual: HeadingSpec = { level, name }
    if (expected[index].id) {
      actual["id"] = heading.id
    }
    return actual
  })
  expect(actual).toEqual(expected)
}
