import React from "react"
import { factories } from "api/test-utils"
import type { LearningResource } from "api/v1"
import { kebabCase } from "lodash"
import { SEARCH_PODCAST_EPISODES, podcastEpisodePath } from "@/common/urls"
import { renderWithProviders, screen, user } from "@/test-utils"
import LatestEpisodesSection from "./LatestEpisodesSection"

const ORIGIN = "http://test.learn.odl.local:8062"

/** The podcast the rows are scoped to, taken from the episode's `podcasts[0]`. */
const CONTEXT_PODCAST_ID = 1

/**
 * The podcast an episode's canonical URL is scoped to, deliberately not the one
 * the rows use: an episode in several podcasts is viewable from any of them, so
 * a row keeps its own context and borrows only the slug from `learn_url`.
 */
const CANONICAL_PARENT_ID = 987654

const makeEpisodes = (count: number): LearningResource[] =>
  Array.from({ length: count }, (_, i) => {
    const episode = factories.learningResources.podcastEpisode({
      title: `Episode ${i + 1}`,
      podcast_episode: {
        id: i + 1,
        podcasts: [CONTEXT_PODCAST_ID],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "https://example.com/link",
      },
    })
    return {
      ...episode,
      // Dedicated-page shape. The row hrefs read their slug from here, so the
      // factory's drawer-shaped default would render a "/search" slug.
      learn_url: `${ORIGIN}/podcast/${CANONICAL_PARENT_ID}/podcast_episode/${
        episode.id
      }/${kebabCase(episode.title)}`,
    }
  }) as unknown as LearningResource[]

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

  it("keeps each episode's podcast context and takes only the backend slug", () => {
    // learn_url is scoped to CANONICAL_PARENT_ID; the row must stay on the
    // episode's own context podcast and borrow only the slug.
    const episodes = makeEpisodes(2)
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

    // Each row is an anchor given role="listitem", so query by that role.
    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(episodes.length)
    episodes.forEach((episode, i) => {
      expect(rows[i]).toHaveTextContent(episode.title!)
      expect(rows[i]).toHaveAttribute(
        "href",
        podcastEpisodePath(
          String(episode.id),
          String(CONTEXT_PODCAST_ID),
          kebabCase(episode.title),
        ),
      )
      // Guards the drawer-shaped-learn_url bug, which would yield "/search".
      expect(rows[i].getAttribute("href")).not.toContain("search")
    })
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
