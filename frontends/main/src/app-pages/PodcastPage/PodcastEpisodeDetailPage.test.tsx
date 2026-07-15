import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import {
  PodcastEpisodeDetailPage,
  applyExternalLinkAttrs,
} from "./PodcastEpisodeDetailPage"

jest.mock("./PodcastPlayer", () =>
  jest.requireActual("./PodcastPlayer.test-utils").mockPodcastPlayer(),
)

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
  const episodeOverridesEpisode = (
    episodeOverrides as Partial<PodcastEpisodeResource>
  ).podcast_episode
  const episode = makePodcastEpisode({
    ...episodeOverrides,
    podcast_episode: {
      podcasts: [podcast.id],
      parent_podcasts: [
        {
          id: podcast.id,
          title: podcast.title!,
          readable_id: podcast.readable_id,
        },
      ],
      ...episodeOverridesEpisode,
    },
  } as Partial<LearningResource>)

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
    const moreEpisodes = [makePodcastEpisode(), makePodcastEpisode()]
    const { episode, podcast } = setupApis({ moreEpisodes })

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
    episode.podcast_episode.podcasts = [podcast.id]
    episode.podcast_episode.parent_podcasts = [
      {
        id: podcast.id,
        title: podcast.title!,
        readable_id: podcast.readable_id,
      },
    ]

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

  test("renders description links, opening external ones in a new tab", async () => {
    const { episode, podcast } = setupApis({
      episodeOverrides: {
        description:
          'Relevant Resources: <a href="https://ocw.mit.edu/">OCW</a> and <a href="/search">Search</a>.',
      },
      moreEpisodes: [],
    })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    // External link renders and is promoted to open in a new tab after mount.
    const externalLink = await screen.findByRole("link", { name: "OCW" })
    expect(externalLink).toHaveAttribute("href", "https://ocw.mit.edu/")
    await waitFor(() =>
      expect(externalLink).toHaveAttribute("target", "_blank"),
    )
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer")

    // Internal link renders and stays in the same tab.
    const internalLink = screen.getByRole("link", { name: "Search" })
    expect(internalLink).toHaveAttribute("href", "/search")
    expect(internalLink).not.toHaveAttribute("target")
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
})
describe("applyExternalLinkAttrs", () => {
  test("opens external links in a new tab", () => {
    const container = document.createElement("div")
    container.innerHTML = '<a href="https://ocw.mit.edu">OCW</a>'

    applyExternalLinkAttrs(container)

    const anchor = container.querySelector("a")!
    expect(anchor.getAttribute("target")).toBe("_blank")
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer")
  })

  test("leaves internal links in the same tab", () => {
    const container = document.createElement("div")
    container.innerHTML = '<a href="/search">Search</a>'

    applyExternalLinkAttrs(container)

    const anchor = container.querySelector("a")!
    expect(anchor.getAttribute("target")).toBeNull()
    expect(anchor.getAttribute("rel")).toBeNull()
  })
})
