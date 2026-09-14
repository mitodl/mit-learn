import React from "react"
import { usePathname } from "next/navigation"
import user from "@testing-library/user-event"
import { allowConsoleErrors } from "ol-test-utilities"
import { renderWithProviders, screen } from "@/test-utils"
import HeaderNavLink from "./HeaderNavLink"

jest.mock("next/navigation", () => ({
  ...jest.requireActual("next/navigation"),
  usePathname: jest.fn(),
}))

const mockUsePathname = jest.mocked(usePathname)

const renderLink = (pathname: string) => {
  mockUsePathname.mockReturnValue(pathname)
  renderWithProviders(
    <HeaderNavLink
      href="/organizational-learning"
      label="For Organizations"
      icon={<svg data-testid="icon" />}
    />,
  )
  return screen.getByRole("link", { name: "For Organizations" })
}

describe("HeaderNavLink", () => {
  test("marks itself as the current page when the pathname matches", () => {
    expect(renderLink("/organizational-learning")).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  test("treats a trailing slash as the same page", () => {
    expect(renderLink("/organizational-learning/")).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  test("omits aria-current on other pages rather than setting it false", () => {
    // aria-current="false" is not the correct falsy form — the attribute must
    // be absent.
    expect(renderLink("/search")).not.toHaveAttribute("aria-current")
  })

  test("does not match a different route that shares a prefix", () => {
    expect(renderLink("/organizational-learning-other")).not.toHaveAttribute(
      "aria-current",
    )
  })

  test("calls onClick when activated", async () => {
    // Following the link is a real navigation, which jsdom does not implement;
    // that console error is expected here and unrelated to the assertion.
    allowConsoleErrors()
    const onClick = jest.fn()
    mockUsePathname.mockReturnValue("/")
    renderWithProviders(
      <HeaderNavLink
        href="/organizational-learning"
        label="For Organizations"
        icon={<svg />}
        onClick={onClick}
      />,
    )

    await user.click(screen.getByRole("link", { name: "For Organizations" }))

    expect(onClick).toHaveBeenCalled()
  })
})
