import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import { PodcastDetailPage } from "./PodcastDetailPage"

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
  {
    next = null,
    previous = null,
  }: { next?: string | null; previous?: string | null } = {},
) => ({
  count: episodes.length,
  next,
  previous,
  results: episodes.map((resource, i) => ({
    id: i + 1,
    child: resource.id,
    parent: 0,
    position: i + 1,
    resource,
  })),
})

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

  setMockResponse.get(
    `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}&offset=0`,
    makeItemsResponse(episodesPage1),
  )

  if (episodesPage2) {
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}&offset=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse(episodesPage2),
    )
  }

  return { podcast }
}

const makePodcastEpisodes = (count: number): PodcastEpisodeResource[] =>
  Array.from({ length: count }, () =>
    factories.learningResources.resource({
      resource_type: ResourceTypeEnum.PodcastEpisode,
    }),
  ) as PodcastEpisodeResource[]

describe("PodcastDetailPage", () => {
  test("renders initial episode list", async () => {
    const episodes = makePodcastEpisodes(3)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    // Wait for the first episode to appear, then assert all are rendered
    await screen.findByText(episodes[0].title!)

    for (const episode of episodes) {
      expect(screen.getByText(episode.title!)).toBeInTheDocument()
    }
  })

  test("does not show 'Load more' when fewer than page size episodes are returned", async () => {
    const episodes = makePodcastEpisodes(3)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)

    expect(
      screen.queryByRole("button", { name: /load more episodes/i }),
    ).not.toBeInTheDocument()
  })

  test("shows 'Load more' button when a full page is returned", async () => {
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

    const loadMoreButton = screen.getByRole("button", {
      name: /load more episodes/i,
    })
    await user.click(loadMoreButton)

    // Both pages' episodes should now be visible
    for (const episode of [...page1, ...page2]) {
      await screen.findByText(episode.title!)
    }

    // "Load more" hidden after receiving a partial page
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /load more episodes/i }),
      ).not.toBeInTheDocument()
    })
  })

  test("clicking play renders the player with correct track title and podcast name", async () => {
    const episodes = makePodcastEpisodes(2)
    const { podcast } = setupApis({ episodesPage1: episodes })

    renderWithProviders(<PodcastDetailPage podcastId={String(podcast.id)} />)

    await screen.findByText(episodes[0].title!)

    expect(screen.queryByTestId("podcast-player")).not.toBeInTheDocument()

    const playButton = screen.getByRole("button", {
      name: `Play ${episodes[0].title}`,
    })
    await user.click(playButton)

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
})
