import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import ArithmixClient from "./ArithmixClient"

jest.mock("@mitodl/arithmix", () => ({
  __esModule: true,
  Arithmix: () => <div data-testid="arithmix">Arithmix Game</div>,
}))

describe("ArithmixClient", () => {
  test("renders the Arithmix component", async () => {
    renderWithProviders(<ArithmixClient />)
    expect(await screen.findByTestId("arithmix")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Arithmix" }),
    ).toBeInTheDocument()
  })
})
