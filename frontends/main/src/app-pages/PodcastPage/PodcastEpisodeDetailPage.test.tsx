import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user } from "@/test-utils"
import {
  PodcastEpisodeDetailPage,
  addExternalLinkTargets,
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
    // rel="noopener noreferrer" mirrors real backend output: nh3 adds it to
    // every <a> during ETL sanitization, regardless of destination.
    const { episode, podcast } = setupApis({
      episodeOverrides: {
        description:
          'Relevant Resources: <a href="https://ocw.mit.edu/" rel="noopener noreferrer">OCW</a> and <a href="/search" rel="noopener noreferrer">Search</a>.',
      },
      moreEpisodes: [],
    })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    // External link renders and opens in a new tab.
    const externalLink = await screen.findByRole("link", { name: "OCW" })
    expect(externalLink).toHaveAttribute("href", "https://ocw.mit.edu/")
    expect(externalLink).toHaveAttribute("target", "_blank")
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer")

    // Internal link renders and stays in the same tab.
    const internalLink = screen.getByRole("link", { name: "Search" })
    expect(internalLink).toHaveAttribute("href", "/search")
    expect(internalLink).not.toHaveAttribute("target")
  })

  test("names the URL's podcast (not the first parent) for a multi-parent episode", async () => {
    const episode = makePodcastEpisode()
    episode.podcast_episode.audio_url = "https://example.com/ep.mp3"
    const podcastA = makePodcast({ title: "Podcast A" })
    const podcastB = makePodcast({ title: "Podcast B" })
    // The episode belongs to both A and B; the user is on B's URL.
    episode.podcast_episode.podcasts = [podcastA.id, podcastB.id]
    episode.podcast_episode.parent_podcasts = [
      {
        id: podcastA.id,
        title: "Podcast A",
        readable_id: podcastA.readable_id,
      },
      {
        id: podcastB.id,
        title: "Podcast B",
        readable_id: podcastB.readable_id,
      },
    ]

    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      episode,
    )
    setMockResponse.get(
      urls.learningResources.details({ id: podcastB.id }),
      podcastB,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcastB.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([episode]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcastB.id)}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: /play episode/i }),
    )

    // The header/breadcrumb and the player bar must agree on Podcast B.
    expect(screen.getByTestId("player-podcast-name")).toHaveTextContent(
      "Podcast B",
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
})
describe("addExternalLinkTargets", () => {
  test("adds target=_blank to external links", () => {
    const html = addExternalLinkTargets('<a href="https://ocw.mit.edu">OCW</a>')
    expect(html).toBe('<a href="https://ocw.mit.edu" target="_blank">OCW</a>')
  })

  test("leaves internal links unchanged", () => {
    const html = addExternalLinkTargets('<a href="/search">Search</a>')
    expect(html).toBe('<a href="/search">Search</a>')
  })

  test("leaves anchors without an href unchanged", () => {
    const html = addExternalLinkTargets('<a name="top">Top</a>')
    expect(html).toBe('<a name="top">Top</a>')
  })

  test("preserves other attributes on external links", () => {
    const html = addExternalLinkTargets(
      '<a href="https://ocw.mit.edu" rel="noopener noreferrer">OCW</a>',
    )
    expect(html).toBe(
      '<a href="https://ocw.mit.edu" rel="noopener noreferrer" target="_blank">OCW</a>',
    )
  })
})
