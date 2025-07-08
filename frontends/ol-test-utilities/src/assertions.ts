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
export const assertHeadings = (expected: HeadingSpec[]) => {
  const headings = screen.getAllByRole("heading")
  const actual = headings.map((heading) => {
    const level = parseInt(heading.tagName[1], 10)
    const name = computeAccessibleName(heading)
    return { level, name }
  })
  expect(actual).toEqual(expected)
}

/**
 * Type assertion that asserts value is not null or undefined.
 *
 * Unlike jest assertions, this will refine the type.
 * See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/41179
 */
export const assertInstanceOf: <
  C extends {
    new (...args: unknown[]): unknown
  },
>(
  value: unknown,
  Class: C,
) => asserts value is InstanceType<C> = (value, Class) => {
  if (value instanceof Class) return
  throw new Error(`Expected value to be instanceof ${Class}`)
}
