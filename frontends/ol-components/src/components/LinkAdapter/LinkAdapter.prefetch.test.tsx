import React from "react"
import NextLink from "next/link"
import { LinkAdapter } from "./LinkAdapter"
import { renderWithTheme } from "../../test-utils"

/**
 * next/link consumes `prefetch` rather than putting it on the DOM, so these
 * assert on what LinkAdapter hands it. That needs the module mocked, which is
 * why they live apart from LinkAdapter.test.tsx, whose cases all rely on the
 * real anchor behaviour.
 */
jest.mock("next/link", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}))
const mockNextLink = jest.mocked(NextLink)

test("pushUrl disables prefetching, since a plain click never follows href", () => {
  renderWithTheme(
    <LinkAdapter href="/search?resource=1" pushUrl="?resource=1">
      Go
    </LinkAdapter>,
  )

  expect(mockNextLink).toHaveBeenCalledWith(
    expect.objectContaining({ prefetch: false }),
    undefined,
  )
})

test("a link without pushUrl keeps next/link's default prefetching", () => {
  renderWithTheme(<LinkAdapter href="/search?resource=1">Go</LinkAdapter>)

  expect(mockNextLink).toHaveBeenCalledWith(
    expect.objectContaining({ prefetch: undefined }),
    undefined,
  )
})

test("an explicit prefetch wins over the pushUrl default", () => {
  renderWithTheme(
    <LinkAdapter href="/search?resource=1" pushUrl="?resource=1" prefetch>
      Go
    </LinkAdapter>,
  )

  expect(mockNextLink).toHaveBeenCalledWith(
    expect.objectContaining({ prefetch: true }),
    undefined,
  )
})
