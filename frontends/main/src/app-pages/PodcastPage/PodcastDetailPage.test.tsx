import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { PodcastDetailPage } from "./PodcastDetailPage"

jest.mock("posthog-js/react")
jest.mock("@/common/useFeatureFlagsLoaded")

const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)

jest.mock(
  "@/page-components/LearningResourceDrawer/LearningResourceDrawer",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
)

jest.mock("./PodcastPlayer", () => ({
  __esModule: true,
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

const makeItemsResponse = (
  episodes: LearningResource[],
  opts: { next?: string | null } = {},
) => ({
  count: episodes.length,
  next: opts.next ?? null,
  previous: null,
  results: episodes.map((resource, i) => ({
    id: i + 1,
    child: resource.id,
    parent: 0,
    position: i + 1,
    resource,
  })),
})

const makePodcastEpisodes = (count: number): PodcastEpisodeResource[] =>
  Array.from({ length: count }, () =>
    factories.learningResources.resource({
      resource_type: ResourceTypeEnum.PodcastEpisode,
    }),
  ) as PodcastEpisodeResource[]

const setupApis = ({
  episodesPage1,
  episodesPage2,
}: {
  episodesPage1: LearningResource[]
  episodesPage2?: LearningResource[]
}) => {
  const podcast = factories.learningResources.resource({
    resource_type: ResourceTypeEnum.Podcast,
  })

  setMockResponse.get(
    urls.learningResources.details({ id: podcast.id }),
    podcast,
  )

  // The code normalises the next URL to BASE_PATH + path, where BASE_PATH is ""
  // in tests, so both the next value and the page-2 mock use the plain path.
  const page2Path = episodesPage2
    ? `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}&offset=${EPISODES_PAGE_SIZE}`
    : null

  setMockResponse.get(
    `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
    makeItemsResponse(episodesPage1, { next: page2Path }),
  )

  if (episodesPage2 && page2Path) {
    setMockResponse.get(page2Path, makeItemsResponse(episodesPage2))
  }

  return { podcast }
}

describe("PodcastDetailPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test("renders initial episode list", async () => {
    const episodes = makePodcastEpisodes(3)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)
    for (const episode of episodes) {
      expect(screen.getByText(episode.title!)).toBeInTheDocument()
    }
  })

  test("does not show 'Load more' when there is no next page", async () => {
    const episodes = makePodcastEpisodes(3)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)
    expect(
      screen.queryByRole("button", { name: /load more episodes/i }),
    ).not.toBeInTheDocument()
  })

  test("shows 'Load more' when API returns a next page URL", async () => {
    const episodes = makePodcastEpisodes(EPISODES_PAGE_SIZE)
    const { podcast } = setupApis({
      episodesPage1: episodes,
      episodesPage2: [],
    })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)
    expect(
      screen.getByRole("button", { name: /load more episodes/i }),
    ).toBeInTheDocument()
  })

  test("loads next page when 'Load more' is clicked", async () => {
    const page1 = makePodcastEpisodes(EPISODES_PAGE_SIZE)
    const page2 = makePodcastEpisodes(2)
    const { podcast } = setupApis({
      episodesPage1: page1,
      episodesPage2: page2,
    })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(page1[0].title!)
    await user.click(
      screen.getByRole("button", { name: /load more episodes/i }),
    )

    for (const episode of page2) {
      await screen.findByText(episode.title!)
    }

    // No more pages — button should disappear
    expect(
      screen.queryByRole("button", { name: /load more episodes/i }),
    ).not.toBeInTheDocument()
  })

  test("clicking play renders the player with correct track and podcast name", async () => {
    const episodes = makePodcastEpisodes(2)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)
    expect(screen.queryByTestId("podcast-player")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: `Play ${episodes[0].title}` }),
    )

    expect(screen.getByTestId("podcast-player")).toBeInTheDocument()
    expect(screen.getByTestId("player-track-title")).toHaveTextContent(
      episodes[0].title!,
    )
    expect(screen.getByTestId("player-podcast-name")).toHaveTextContent(
      podcast.title!,
    )
  })

  test("shows 'No episodes found' when episode list is empty", async () => {
    const { podcast } = setupApis({ episodesPage1: [] })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(/no episodes found/i)
  })

  test("disables play button for episodes without audio source", async () => {
    const [episodeWithoutAudio] = makePodcastEpisodes(1)
    if (episodeWithoutAudio.podcast_episode) {
      episodeWithoutAudio.podcast_episode.audio_url = ""
      episodeWithoutAudio.podcast_episode.episode_link = ""
    }

    const { podcast } = setupApis({ episodesPage1: [episodeWithoutAudio] })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    const playButton = await screen.findByRole("button", {
      name: `Play ${episodeWithoutAudio.title}`,
    })

    expect(playButton).toBeDisabled()
    expect(screen.queryByTestId("podcast-player")).not.toBeInTheDocument()
  })
})
