import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import HeroSection from "./HeroSection"

describe("HeroSection", () => {
  it("renders the heading and description", () => {
    renderWithProviders(<HeroSection totalSeries={250} totalEpisodes={1234} />)
    expect(screen.getByText("Podcasts from across MIT")).toBeInTheDocument()
    expect(
      screen.getByText("New podcast episodes and series."),
    ).toBeInTheDocument()
  })

  it("renders approximate series and episode counts", () => {
    renderWithProviders(<HeroSection totalSeries={250} totalEpisodes={1234} />)
    expect(screen.getByText(/200\+ series/)).toBeInTheDocument()
    expect(screen.getByText(/1200\+ episodes/)).toBeInTheDocument()
    expect(screen.getByText(/Updated daily/)).toBeInTheDocument()
  })

  it("renders exact counts when below the rounding threshold", () => {
    renderWithProviders(<HeroSection totalSeries={5} totalEpisodes={42} />)
    expect(screen.getByText(/5 series/)).toBeInTheDocument()
    expect(screen.getByText(/42 episodes/)).toBeInTheDocument()
  })
})
