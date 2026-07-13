import React from "react"
import { factories } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import NowPlayingSection from "./NowPlayingSection"

const makeEpisode = (overrides = {}): LearningResource =>
  factories.learningResources.podcastEpisode({
    title: "Now Playing Episode",
    description: "<p>Now Playing Episode description</p>",
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

describe("NowPlayingSection", () => {
  it("renders nothing when there is no now-playing episode", () => {
    const { view } = renderWithProviders(
      <NowPlayingSection
        nowPlaying={undefined}
        isPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
      />,
    )
    expect(view.container).toBeEmptyDOMElement()
  })

  it("renders nothing when the resource is not a podcast episode", () => {
    const course = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Course,
    })
    const { view } = renderWithProviders(
      <NowPlayingSection
        nowPlaying={course}
        isPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
      />,
    )
    expect(view.container).toBeEmptyDOMElement()
  })

  it("renders the now playing card with title and sanitized description", () => {
    const episode = makeEpisode({
      description: '<script>alert("xss")</script><p>Featured summary</p>',
    })
    renderWithProviders(
      <NowPlayingSection
        nowPlaying={episode}
        isPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
      />,
    )
    expect(screen.getByText("NOW PLAYING")).toBeInTheDocument()
    expect(screen.getByText("Now Playing Episode")).toBeInTheDocument()
    expect(screen.getByText("Featured summary")).toBeInTheDocument()
    expect(document.querySelector("script")).not.toBeInTheDocument()
  })

  it("calls onPlayClick when 'Play episode' is clicked", async () => {
    const episode = makeEpisode()
    const onPlayClick = jest.fn()
    renderWithProviders(
      <NowPlayingSection
        nowPlaying={episode}
        isPlaying={false}
        onPlayClick={onPlayClick}
        onPauseClick={jest.fn()}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Play episode" }))
    expect(onPlayClick).toHaveBeenCalledWith(episode)
  })

  it("calls onPauseClick when 'Pause episode' is clicked", async () => {
    const episode = makeEpisode()
    const onPauseClick = jest.fn()
    renderWithProviders(
      <NowPlayingSection
        nowPlaying={episode}
        isPlaying={true}
        onPlayClick={jest.fn()}
        onPauseClick={onPauseClick}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Pause episode" }))
    expect(onPauseClick).toHaveBeenCalled()
  })

  it("disables the play button when there is no audio available", () => {
    const episode = makeEpisode({
      podcast_episode: {
        id: 1,
        podcasts: [1],
        duration: "PT2H",
        audio_url: "",
        episode_link: "",
      },
    })
    renderWithProviders(
      <NowPlayingSection
        nowPlaying={episode}
        isPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: "Play episode" })).toBeDisabled()
  })

  it("renders duration and date meta", () => {
    const episode = makeEpisode()
    renderWithProviders(
      <NowPlayingSection
        nowPlaying={episode}
        isPlaying={false}
        onPlayClick={jest.fn()}
        onPauseClick={jest.fn()}
      />,
    )
    expect(screen.getByText(/120 min/)).toBeInTheDocument()
    expect(screen.getByText(/May 3/)).toBeInTheDocument()
  })
})
