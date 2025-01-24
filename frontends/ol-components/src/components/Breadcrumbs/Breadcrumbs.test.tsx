import React from "react"
import { screen } from "@testing-library/react"
import { Breadcrumbs } from "./Breadcrumbs"
import { renderWithTheme } from "../../test-utils"

// Mock react-router-dom's Link so we don't need to set up a Router
jest.mock("react-router-dom", () => {
  return {
    Link: jest.fn((props) => <a href={props.to}>{props.children}</a>),
  }
})

describe("Breadcrumbs", () => {
  test.each([
    { ancestors: [{ href: "/home", label: "Home" }] },
    {
      ancestors: [
        { href: "/home", label: "Home" },
        { href: "/parent", label: "Parent" },
      ],
    },
    {
      ancestors: [
        { href: "/home", label: "Home" },
        { href: "/parent", label: "Grandparent" },
        { href: "/grandparent", label: "Parent" },
      ],
    },
  ])(
    "renders a Breadcrumbs component with a one or more ancestors",
    ({ ancestors }) => {
      renderWithTheme(
        <Breadcrumbs variant="light" ancestors={ancestors} current="Current" />,
      )
      const totalAncestors = ancestors.length
      const expectedHrefs = ancestors.map(({ href }) => href)
      const expectedLabels = ancestors.map(({ label }) => label)
      expect(screen.getAllByTestId("breadcrumb-separator")).toHaveLength(
        totalAncestors,
      )
      expect(screen.getAllByRole("link")).toHaveLength(totalAncestors)
      expectedLabels.forEach((label, index) => {
        const link = screen.getByText(label).parentElement
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute("href", expectedHrefs[index])
      })
    },
  )
})
