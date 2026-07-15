import React from "react"
import { factories } from "api/test-utils"
import type { LearningResource } from "api/v1"
import { SEARCH_PODCASTS, podcastPageView } from "@/common/urls"
import { renderWithProviders, screen } from "@/test-utils"
import PodcastSection from "./PodcastSection"

const makeSeries = (overrides = {}): LearningResource =>
  factories.learningResources.podcast({
    id: 1,
    title: "Chalk Radio",
    description: "A podcast about teaching at MIT",
    last_modified: "2024-05-03T00:00:00Z",
    offered_by: { name: "OCW", code: "ocw" },
    podcast: { id: 1, episode_count: 12 },
    ...overrides,
  }) as unknown as LearningResource

describe("PodcastSection", () => {
  it("renders the section header and 'All podcasts' link", () => {
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
      />,
    )
    expect(screen.getByText("Podcasts across MIT")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "All podcasts" })).toHaveAttribute(
      "href",
      SEARCH_PODCASTS,
    )
  })

  it("does not render the featured block when there is no featured series", () => {
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
      />,
    )
    expect(screen.queryByText("FEATURED")).not.toBeInTheDocument()
  })

  it("renders featured series cards with title, summary, and meta", () => {
    const series = makeSeries()
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[series]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
      />,
    )
    expect(screen.getByText("FEATURED")).toBeInTheDocument()
    expect(screen.getByText("Chalk Radio")).toBeInTheDocument()
    expect(
      screen.getByText("A podcast about teaching at MIT"),
    ).toBeInTheDocument()
    expect(screen.getByText(/12 episodes/)).toBeInTheDocument()
    expect(screen.getByText(/Updated May 3/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Chalk Radio/ })).toHaveAttribute(
      "href",
      podcastPageView("1", "Chalk Radio"),
    )
  })

  it("renders 'More Podcasts' rows with title and offered_by", () => {
    const series = makeSeries({
      title: "The Aggregate",
      offered_by: { name: "MITx", code: "mitx" },
      podcast: { id: 2, episode_count: 5 },
    })
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[series]}
        hasMorePodcasts={false}
        totalPodcasts={1}
        isMobile={false}
      />,
    )
    expect(screen.getByText("More Podcasts")).toBeInTheDocument()
    expect(screen.getByText("The Aggregate")).toBeInTheDocument()
    expect(screen.getByText("MITx")).toBeInTheDocument()
    expect(screen.getByText(/5 episodes/)).toBeInTheDocument()
  })

  it("shows an empty-state message when not loading and there are no podcasts", () => {
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
      />,
    )
    expect(screen.getByText("More Podcasts")).toBeInTheDocument()
    expect(
      screen.getByText("No podcasts available right now."),
    ).toBeInTheDocument()
  })

  it("shows skeletons while loading and hides the empty state", () => {
    const { view } = renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
        isLoading={true}
      />,
    )
    expect(
      view.container.querySelectorAll(".MuiSkeleton-root").length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText("No podcasts available right now."),
    ).not.toBeInTheDocument()
  })

  it("renders featured skeletons while featured podcasts are loading", () => {
    const { view } = renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
        isFeaturedLoading={true}
      />,
    )
    expect(screen.getByText("FEATURED")).toBeInTheDocument()
    expect(
      view.container.querySelectorAll(".MuiSkeleton-root").length,
    ).toBeGreaterThan(0)
  })

  it("shows an error message when the request fails", () => {
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={false}
        totalPodcasts={0}
        isMobile={false}
        isError={true}
      />,
    )
    expect(
      screen.getByText(
        "Something went wrong loading podcasts. Please try again later.",
      ),
    ).toBeInTheDocument()
  })

  it("does not show the 'View all' button when there are no podcast rows", () => {
    renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[]}
        hasMorePodcasts={true}
        totalPodcasts={250}
        isMobile={false}
      />,
    )
    expect(
      screen.queryByRole("link", { name: /view all/i }),
    ).not.toBeInTheDocument()
  })

  it("shows the 'View all' button only when hasMoreSeries is true", () => {
    const series = makeSeries()
    const { view } = renderWithProviders(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[series]}
        hasMorePodcasts={false}
        totalPodcasts={150}
        isMobile={false}
      />,
    )
    expect(
      screen.queryByRole("link", { name: /view all/i }),
    ).not.toBeInTheDocument()

    view.rerender(
      <PodcastSection
        featuredPodcasts={[]}
        morePodcasts={[series]}
        hasMorePodcasts={true}
        totalPodcasts={150}
        isMobile={false}
      />,
    )
    const viewAllLink = screen.getByRole("link", {
      name: /view all 100\+ podcasts/i,
    })
    expect(viewAllLink).toHaveAttribute("href", SEARCH_PODCASTS)
  })
})
