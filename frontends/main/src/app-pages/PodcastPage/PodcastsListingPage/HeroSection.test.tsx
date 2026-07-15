import React from "react"
import { renderWithProviders, screen } from "@/test-utils"
import HeroSection from "./HeroSection"

describe("HeroSection", () => {
  it("renders the heading and description", () => {
    renderWithProviders(
      <HeroSection totalPodcasts={250} totalEpisodes={1234} />,
    )
    expect(screen.getByText("Podcasts from across MIT")).toBeInTheDocument()
    expect(
      screen.getByText("New podcast episodes and podcasts."),
    ).toBeInTheDocument()
  })

  it("renders approximate podcast and episode counts", () => {
    renderWithProviders(
      <HeroSection totalPodcasts={250} totalEpisodes={1234} />,
    )
    expect(screen.getByText(/200\+ podcasts/)).toBeInTheDocument()
    expect(screen.getByText(/1200\+ episodes/)).toBeInTheDocument()
    expect(screen.getByText(/Updated daily/)).toBeInTheDocument()
  })

  it("renders exact counts when below the rounding threshold", () => {
    renderWithProviders(<HeroSection totalPodcasts={5} totalEpisodes={42} />)
    expect(screen.getByText(/5 podcasts/)).toBeInTheDocument()
    expect(screen.getByText(/42 episodes/)).toBeInTheDocument()
  })

  it("shows a skeleton instead of the stats while loading", () => {
    const { view } = renderWithProviders(
      <HeroSection totalPodcasts={0} totalEpisodes={0} isLoading={true} />,
    )
    // The "0 podcasts • 0 episodes • Updated daily" line must not flash before
    // data loads.
    expect(screen.queryByText(/Updated daily/)).not.toBeInTheDocument()
    expect(
      view.container.querySelectorAll(".MuiSkeleton-root").length,
    ).toBeGreaterThan(0)
  })
})
