import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import { PodcastDetailPage } from "./PodcastDetailPage"

jest.mock(
  "@/page-components/LearningResourceDrawer/LearningResourceDrawer",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
)

jest.mock("./PodcastPlayer", () =>
  jest.requireActual("./PodcastPlayer.test-utils").mockPodcastPlayer(),
)

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

  // Episodes of this podcast reference it as their parent, as they would in
  // production. The player resolves its "podcast name" from this summary.
  const linkParent = (episodes: LearningResource[]) =>
    episodes.forEach((episode) => {
      if (episode.resource_type === ResourceTypeEnum.PodcastEpisode) {
        episode.podcast_episode.podcasts = [podcast.id]
        episode.podcast_episode.parent_podcasts = [
          {
            id: podcast.id,
            title: podcast.title!,
            readable_id: podcast.readable_id,
          },
        ]
      }
    })
  linkParent(episodesPage1)
  if (episodesPage2) linkParent(episodesPage2)

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

  test("shows a loading skeleton while fetching", async () => {
    const episodes = makePodcastEpisodes(2)
    const { podcast } = setupApis({ episodesPage1: episodes })

    const { view } = renderWithProviders(
      <PodcastDetailPage podcastId={String(podcast.id)} />,
    )

    // Skeleton is visible on first paint, before the queries resolve.
    expect(
      view.container.querySelectorAll(".MuiSkeleton-root").length,
    ).toBeGreaterThan(0)

    // Flush to the loaded state to avoid act() warnings.
    await screen.findByText(episodes[0].title!)
  })

  test("shows an error when the podcast fails to load", async () => {
    const podcast = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Podcast,
    })
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      "Server error",
      { code: 500 },
    )

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    expect(
      await screen.findByText(/something went wrong loading this podcast/i),
    ).toBeInTheDocument()
  })

  test("shows an error when the episode list fails to load", async () => {
    const podcast = factories.learningResources.resource({
      resource_type: ResourceTypeEnum.Podcast,
    })
    setMockResponse.get(
      urls.learningResources.details({ id: podcast.id }),
      podcast,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      "Server error",
      { code: 500 },
    )

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    expect(
      await screen.findByText(/something went wrong loading episodes/i),
    ).toBeInTheDocument()
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
