import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import Page, { metadata } from "./page"

jest.mock("./ArithmixClient", () => ({
  __esModule: true,
  default: () => <div data-testid="arithmix-client">Arithmix Client</div>,
}))

describe("arithmix page.tsx", () => {
  test("renders the ArithmixClient", () => {
    renderWithProviders(
      <Page params={Promise.resolve({})} searchParams={Promise.resolve({})} />,
    )
    expect(screen.getByTestId("arithmix-client")).toBeInTheDocument()
  })

  test("sets the page title metadata", () => {
    expect(metadata.title).toContain("Arithmix")
  })
})
