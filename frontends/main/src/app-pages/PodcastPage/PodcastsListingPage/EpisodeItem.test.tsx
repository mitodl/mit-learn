import React from "react"
import { factories } from "api/test-utils"
import type { LearningResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import { EpisodeItem } from "./EpisodeItem"

const makeEpisode = (overrides = {}): LearningResource =>
  factories.learningResources.podcastEpisode({
    title: "Episode Title",
    description: "<p>Some episode description</p>",
    last_modified: "2024-05-03T00:00:00Z",
    podcast_episode: {
      id: 1,
      podcasts: [1],
      duration: "PT2H",
      audio_url: "https://example.com/audio.mp3",
      episode_link: "https://example.com/link",
    },
    ...overrides,
  }) as unknown as LearningResource

describe("EpisodeItem", () => {
  it("renders the episode title", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="/podcast/1/podcast_episode/1"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    expect(screen.getByText("Episode Title")).toBeInTheDocument()
  })

  it("shows the overline only on mobile", () => {
    const episode = makeEpisode()
    const { view } = renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        overline="MIT Radio"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    expect(screen.queryByText("MIT Radio")).not.toBeInTheDocument()

    view.rerender(
      <EpisodeItem
        episode={episode}
        href="#"
        overline="MIT Radio"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={true}
      />,
    )
    expect(screen.getByText("MIT Radio")).toBeInTheDocument()
  })

  it("renders a sanitized description only on mobile", () => {
    const episode = makeEpisode({
      description: '<script>alert("xss")</script><p>Safe text</p>',
    })
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={true}
      />,
    )
    expect(screen.getByText("Safe text")).toBeInTheDocument()
    expect(document.querySelector("script")).not.toBeInTheDocument()
  })

  it("does not render a description when not on mobile", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    expect(
      screen.queryByText("Some episode description"),
    ).not.toBeInTheDocument()
  })

  it("renders the duration and formatted date", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    expect(screen.getByText(/120 min/)).toBeInTheDocument()
    expect(screen.getByText(/May 3/)).toBeInTheDocument()
  })

  it("calls onPlayClick when the play button is clicked and not playing", async () => {
    const episode = makeEpisode()
    const onPlayClick = jest.fn()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={onPlayClick}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Play Episode Title" }))
    expect(onPlayClick).toHaveBeenCalledWith(episode)
  })

  it("calls onPauseClick when the pause button is clicked while playing", async () => {
    const episode = makeEpisode()
    const onPauseClick = jest.fn()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={jest.fn()}
        onPauseClick={onPauseClick}
        isPlaying={true}
        isPlayable={true}
        isMobile={false}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Pause Episode Title" }),
    )
    expect(onPauseClick).toHaveBeenCalled()
  })

  it("disables the play button when not playable", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="#"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={false}
        isMobile={false}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Play Episode Title" }),
    ).toBeDisabled()
  })

  it("links to the provided href", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <EpisodeItem
        episode={episode}
        href="/podcast/1/podcast_episode/1/episode-title"
        onPlayClick={jest.fn()}
        isPlaying={false}
        isPlayable={true}
        isMobile={false}
      />,
    )
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/podcast/1/podcast_episode/1/episode-title",
    )
  })
})
