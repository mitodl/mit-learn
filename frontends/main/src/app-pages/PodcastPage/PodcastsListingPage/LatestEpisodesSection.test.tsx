import React from "react"
import { factories } from "api/test-utils"
import type { LearningResource } from "api/v1"
import { SEARCH_PODCAST_EPISODES } from "@/common/urls"
import { renderWithProviders, screen, user } from "@/test-utils"
import LatestEpisodesSection from "./LatestEpisodesSection"

const makeEpisodes = (count: number): LearningResource[] =>
  Array.from({ length: count }, (_, i) =>
    factories.learningResources.podcastEpisode({
      title: `Episode ${i + 1}`,
      podcast_episode: {
        id: i + 1,
        podcasts: [1],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    }),
  ) as unknown as LearningResource[]

describe("LatestEpisodesSection", () => {
  it("renders the section header", () => {
    renderWithProviders(
      <LatestEpisodesSection
        episodes={[]}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    expect(screen.getByText("Latest Episodes")).toBeInTheDocument()
    expect(screen.getByText("All episodes")).toBeInTheDocument()
  })

  it("renders all provided episodes", () => {
    const episodes = makeEpisodes(3)
    renderWithProviders(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    for (const episode of episodes) {
      expect(screen.getByText(episode.title!)).toBeInTheDocument()
    }
  })

  it("does not render a list when there are no episodes", () => {
    renderWithProviders(
      <LatestEpisodesSection
        episodes={[]}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("shows an empty-state message when not loading and there are no episodes", () => {
    renderWithProviders(
      <LatestEpisodesSection
        episodes={[]}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    expect(
      screen.getByText("No episodes available right now."),
    ).toBeInTheDocument()
  })

  it("shows skeletons and no empty/error message while loading", () => {
    const { view } = renderWithProviders(
      <LatestEpisodesSection
        episodes={[]}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
        isLoading={true}
      />,
    )
    expect(
      view.container.querySelectorAll(".MuiSkeleton-root").length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText("No episodes available right now."),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("shows an error message when the request fails", () => {
    renderWithProviders(
      <LatestEpisodesSection
        episodes={[]}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
        isError={true}
      />,
    )
    expect(
      screen.getByText(
        "Something went wrong loading episodes. Please try again later.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("No episodes available right now."),
    ).not.toBeInTheDocument()
  })

  it("shows the 'Load more episodes' link only when hasMoreEpisodes is true", () => {
    const episodes = makeEpisodes(1)
    const { view } = renderWithProviders(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    expect(
      screen.queryByRole("link", { name: /load more episodes/i }),
    ).not.toBeInTheDocument()

    view.rerender(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={true}
        isPlayable={() => true}
      />,
    )
    const loadMoreLink = screen.getByRole("link", {
      name: /load more episodes/i,
    })
    expect(loadMoreLink).toHaveAttribute("href", SEARCH_PODCAST_EPISODES)
  })

  it("calls onPlayClick with the clicked episode", async () => {
    const episodes = makeEpisodes(2)
    const onPlayClick = jest.fn()
    renderWithProviders(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={onPlayClick}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Play Episode 2" }))
    expect(onPlayClick).toHaveBeenCalledWith(episodes[1])
  })

  it("marks only the currently playing episode as playing", () => {
    const episodes = makeEpisodes(2)
    renderWithProviders(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        playingEpisodeId={episodes[1].id}
        isAudioPlaying={true}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => true}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Play Episode 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Pause Episode 2" }),
    ).toBeInTheDocument()
  })

  it("disables the play button for episodes that are not playable", () => {
    const episodes = makeEpisodes(1)
    renderWithProviders(
      <LatestEpisodesSection
        episodes={episodes}
        isMobile={false}
        isAudioPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
        hasMoreEpisodes={false}
        isPlayable={() => false}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Play Episode 1" }),
    ).toBeDisabled()
  })
})
