import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { PodcastEpisodeDetailPage } from "./PodcastEpisodeDetailPage"

jest.mock("posthog-js/react")
jest.mock("@/common/useFeatureFlagsLoaded")

const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

jest.mock("./PodcastPlayer", () => ({
  __esModule: true,
  PLAYER_HEIGHT: { desktop: 104, mobile: 220 },
  default: jest.fn(
    ({ track }: { track: { title: string; podcastName: string } }) => (
      <div data-testid="podcast-player">
        <span data-testid="player-track-title">{track.title}</span>
        <span data-testid="player-podcast-name">{track.podcastName}</span>
      </div>
    ),
  ),
}))

const EPISODES_PAGE_SIZE = 5

const makeItemsResponse = (episodes: LearningResource[]) => ({
  count: episodes.length,
  next: null,
  previous: null,
  results: episodes.map((resource, i) => ({
    id: i + 1,
    child: resource.id,
    parent: 0,
    position: i + 1,
    resource,
  })),
})

const makePodcastEpisode = (
  overrides: Partial<LearningResource> = {},
): PodcastEpisodeResource =>
  factories.learningResources.resource({
    resource_type: ResourceTypeEnum.PodcastEpisode,
    ...overrides,
  }) as PodcastEpisodeResource

const makePodcast = (
  overrides: Partial<LearningResource> = {},
): LearningResource =>
  factories.learningResources.resource({
    resource_type: ResourceTypeEnum.Podcast,
    ...overrides,
  })

type SetupOptions = {
  episodeOverrides?: Partial<LearningResource>
  podcastOverrides?: Partial<LearningResource>
  moreEpisodes?: LearningResource[]
}

const setupApis = ({
  episodeOverrides = {},
  podcastOverrides = {},
  moreEpisodes,
}: SetupOptions = {}) => {
  const podcast = makePodcast(podcastOverrides)
  const episode = makePodcastEpisode(episodeOverrides)

  setMockResponse.get(
    urls.learningResources.details({ id: episode.id }),
    episode,
  )
  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )

  const episodeList = moreEpisodes ?? [episode]
  setMockResponse.get(
    `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
    makeItemsResponse(episodeList),
  )

  return { episode, podcast }
}

describe("PodcastEpisodeDetailPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("renders episode title and podcast name on the page", async () => {
    const { episode, podcast } = setupApis({ moreEpisodes: [] })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    // Episode title appears in the breadcrumb current item and as the styled heading
    const episodeTitles = await screen.findAllByText(episode.title!)
    expect(episodeTitles.length).toBeGreaterThanOrEqual(1)

    // Podcast title appears as the EpisodeLabel and in the breadcrumb link
    const podcastTitles = screen.getAllByText(podcast.title!)
    expect(podcastTitles.length).toBeGreaterThanOrEqual(2)
  })

  test("renders 'More from <podcast>' section header", async () => {
    const { episode, podcast } = setupApis()

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    await screen.findByText(new RegExp(`More from ${podcast.title}`, "i"))
  })

  test("renders 'More from' episode list items", async () => {
    const moreEpisodes = [makePodcastEpisode(), makePodcastEpisode()]
    const { episode, podcast } = setupApis({ moreEpisodes })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    await screen.findByText(moreEpisodes[0].title!)
    expect(screen.getByText(moreEpisodes[1].title!)).toBeInTheDocument()
  })

  test("play button is present and enabled when episode has an audio URL", async () => {
    const episode = makePodcastEpisode()
    // Ensure audio_url is set (factories should set it, but be explicit)
    episode.podcast_episode.audio_url = "https://example.com/ep.mp3"
    const podcast = makePodcast()

    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      episode,
    )
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      podcast,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([episode]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    const playButton = await screen.findByRole("button", {
      name: /play episode/i,
    })
    expect(playButton).not.toBeDisabled()
  })

  test("play button is disabled when episode has no audio source", async () => {
    const episode = makePodcastEpisode()
    episode.podcast_episode.audio_url = ""
    episode.podcast_episode.episode_link = ""
    const podcast = makePodcast()

    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      episode,
    )
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      podcast,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([episode]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    const playButton = await screen.findByRole("button", {
      name: /play episode/i,
    })
    expect(playButton).toBeDisabled()
  })

  test("clicking play renders the PodcastPlayer with correct track data", async () => {
    const episode = makePodcastEpisode()
    episode.podcast_episode.audio_url = "https://example.com/ep.mp3"
    const podcast = makePodcast()

    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      episode,
    )
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      podcast,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([episode]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    expect(screen.queryByTestId("podcast-player")).not.toBeInTheDocument()

    const playButton = await screen.findByRole("button", {
      name: /play episode/i,
    })
    await user.click(playButton)

    expect(screen.getByTestId("podcast-player")).toBeInTheDocument()
    expect(screen.getByTestId("player-track-title")).toHaveTextContent(
      episode.title!,
    )
    expect(screen.getByTestId("player-podcast-name")).toHaveTextContent(
      podcast.title!,
    )
  })

  test("clicking play in 'More from' list renders the player for that episode", async () => {
    const moreEpisode = makePodcastEpisode()
    moreEpisode.podcast_episode.audio_url = "https://example.com/more.mp3"
    const { episode, podcast } = setupApis({ moreEpisodes: [moreEpisode] })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    await screen.findByText(moreEpisode.title!)
    const playButtons = await screen.findAllByRole("button", {
      name: new RegExp(`Play ${moreEpisode.title}`),
    })
    await user.click(playButtons[0])

    expect(screen.getByTestId("podcast-player")).toBeInTheDocument()
    expect(screen.getByTestId("player-track-title")).toHaveTextContent(
      moreEpisode.title!,
    )
  })

  test("returns null (not found) when feature flag is not loaded yet", () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(false)
    mockedUseFeatureFlagEnabled.mockReturnValue(false)

    const episode = makePodcastEpisode()
    const podcast = makePodcast()

    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      episode,
    )
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      podcast,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([]),
    )

    const { view } = renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    expect(view.container).toBeEmptyDOMElement()
  })
})
