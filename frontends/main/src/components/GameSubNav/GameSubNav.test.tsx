import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import GameSubNav from "./GameSubNav"
import * as urls from "@/common/urls"

describe("GameSubNav", () => {
  test("shows the game's title as the page heading", () => {
    renderWithProviders(<GameSubNav title="HackSnack" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "HackSnack" }),
    ).toBeInTheDocument()
  })

  test("links to the home page rather than popping history", () => {
    renderWithProviders(<GameSubNav title="HackSnack" />)
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      urls.HOME,
    )
  })
})
