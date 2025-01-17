import React from "react"
import { screen } from "@testing-library/react"
import { ButtonLink, ActionButtonLink } from "./Button"
import Link from "next/link"
import { renderWithTheme } from "../../test-utils"

jest.mock("next/link", () => {
  const Actual = jest.requireActual("next/link")
  return {
    __esModule: true,
    default: jest.fn((args) => <Actual.default {...args} />),
  }
})

describe("ButtonLink", () => {
  test.each([
    {
      rawAnchor: undefined,
      label: "Link",
    },
    {
      rawAnchor: false,
      label: "Link",
    },
    {
      rawAnchor: true,
      label: "Anchor",
    },
  ])("renders with anchor tag if rawAnchor=$rawAnchor", ({ rawAnchor }) => {
    renderWithTheme(
      <ButtonLink href="/test" rawAnchor={rawAnchor}>
        Link text here
      </ButtonLink>,
    )
    screen.getByRole("link")
    if (rawAnchor) {
      expect(Link).not.toHaveBeenCalled()
    } else {
      expect(Link).toHaveBeenCalled()
    }
  })
})

describe("ActionButtonLink", () => {
  test.each([
    {
      rawAnchor: undefined,
      label: "Link",
    },
    {
      rawAnchor: false,
      label: "Link",
    },
    {
      rawAnchor: true,
      label: "Anchor",
    },
  ])("renders with rawAnchor if rawAnchor=$rawAnchor", ({ rawAnchor }) => {
    renderWithTheme(
      <ActionButtonLink href="/test" rawAnchor={rawAnchor}>
        Link text here
      </ActionButtonLink>,
    )
    screen.getByRole("link")
    if (rawAnchor) {
      expect(Link).not.toHaveBeenCalled()
    } else {
      expect(Link).toHaveBeenCalled()
    }
  })
})
