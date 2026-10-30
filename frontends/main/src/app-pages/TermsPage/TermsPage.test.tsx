import React from "react"
import { screen, setMockResponse, renderWithProviders } from "@/test-utils"
import { urls } from "api/test-utils"
import { Permission } from "api/hooks/user"
import TermsPage, { OPEN_LICENSE_ID } from "./TermsPage"

describe("TermsPage", () => {
  test("Renders title", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    renderWithProviders(<TermsPage />)
    screen.getByRole("heading", {
      name: "Terms of Service",
    })
  })

  test("Renders the Openly Licensed Content section with a linkable anchor", async () => {
    setMockResponse.get(urls.userMe.get(), {
      [Permission.Authenticated]: true,
    })

    renderWithProviders(<TermsPage />)
    const heading = screen.getByRole("heading", {
      name: "Openly Licensed Content",
    })
    expect(heading).toHaveAttribute("id", OPEN_LICENSE_ID)
    const links = screen.getAllByRole("link", {
      name: "Openly Licensed Content",
    })
    expect(links.length).toBe(2)
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", `#${OPEN_LICENSE_ID}`)
    })
  })
})
