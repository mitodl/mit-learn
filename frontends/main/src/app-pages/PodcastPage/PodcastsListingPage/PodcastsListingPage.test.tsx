import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum, LearningResourcesListSortbyEnum } from "api/v1"
import type { LearningResource } from "api/v1"
import { assertHeadings } from "ol-test-utilities"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import {
  EPISODES_PAGE_SIZE,
  PODCAST_FEATURED_COUNT,
  PODCAST_MORE_COUNT,
} from "./constants"
import { PodcastsListingPage } from "./PodcastsListingPage"

const ENV_KEY = "NEXT_PUBLIC_PODCASTS_FEATURED_LIST_LEARNINGPATH_ID"

jest.mock("../PodcastPlayer", () =>
  jest.requireActual("../PodcastPlayer.test-utils").mockPodcastPlayer(),
)

const makeEpisode = (overrides = {}): LearningResource =>
  factories.learningResources.podcastEpisode({
    podcast_episode: {
      id: 1,
      podcasts: [1],
      duration: "PT1M",
      audio_url: "https://example.com/audio.mp3",
      episode_link: "https://example.com/link",
    },
    ...overrides,
  }) as unknown as LearningResource

const makePodcast = (overrides = {}): LearningResource =>
  factories.learningResources.podcast({
    podcast: { id: 1, episode_count: 10 },
    ...overrides,
  }) as unknown as LearningResource

const makeLearningPathItemsResponse = (resources: LearningResource[]) => ({
  count: resources.length,
  next: null,
  previous: null,
  results: resources.map((resource, i) => ({
    id: i + 1,
    child: resource.id,
    parent: 0,
    position: i + 1,
    resource,
  })),
})

const setupApis = ({
  episodes = [],
  totalEpisodes = episodes.length,
  podcasts = [],
  totalPodcasts = podcasts.length,
  featuredLearningPathId,
  featuredPodcast = [],
}: {
  episodes?: LearningResource[]
  totalEpisodes?: number
  podcasts?: LearningResource[]
  totalPodcasts?: number
  featuredLearningPathId?: number
  featuredPodcast?: LearningResource[]
}) => {
  setMockResponse.get(
    urls.learningResources.list({
      resource_type: [ResourceTypeEnum.PodcastEpisode],
      sortby: LearningResourcesListSortbyEnum.New,
      limit: EPISODES_PAGE_SIZE + 1,
    }),
    { count: totalEpisodes, next: null, previous: null, results: episodes },
  )

  setMockResponse.get(
    urls.learningResources.list({
      resource_type: [ResourceTypeEnum.Podcast],
      sortby: LearningResourcesListSortbyEnum.New,
      limit: PODCAST_MORE_COUNT,
    }),
    { count: totalPodcasts, next: null, previous: null, results: podcasts },
  )

  if (featuredLearningPathId) {
    setMockResponse.get(
      urls.learningPaths.resources({
        learning_resource_id: featuredLearningPathId,
        limit: PODCAST_FEATURED_COUNT,
      }),
      makeLearningPathItemsResponse(featuredPodcast),
    )
  }
}

describe("PodcastsListingPage", () => {
  const originalEnv = process.env[ENV_KEY]

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = originalEnv
    }
  })

  it("renders hero stats from the episode and series counts", async () => {
    delete process.env[ENV_KEY]
    setupApis({ totalEpisodes: 1234, totalPodcasts: 250 })

    renderWithProviders(<PodcastsListingPage />)

    expect(await screen.findByText(/1200\+ episodes/)).toBeInTheDocument()
    expect(screen.getByText(/200\+ podcasts/)).toBeInTheDocument()
  })

  it("renders the first episode as 'Now Playing' and the rest as 'Latest Episodes'", async () => {
    delete process.env[ENV_KEY]
    const episodes = [
      makeEpisode({
        title: "First Episode",
        podcast_episode: {
          id: 1,
          podcasts: [1],
          duration: "PT1M",
          audio_url: "https://example.com/1.mp3",
          episode_link: "",
        },
      }),
      makeEpisode({
        title: "Second Episode",
        podcast_episode: {
          id: 2,
          podcasts: [1],
          duration: "PT1M",
          audio_url: "https://example.com/2.mp3",
          episode_link: "",
        },
      }),
      makeEpisode({
        title: "Third Episode",
        podcast_episode: {
          id: 3,
          podcasts: [1],
          duration: "PT1M",
          audio_url: "https://example.com/3.mp3",
          episode_link: "",
        },
      }),
    ]
    setupApis({ episodes, totalEpisodes: episodes.length })

    renderWithProviders(<PodcastsListingPage />)

    await screen.findByText("First Episode")
    expect(screen.getByText("NOW PLAYING")).toBeInTheDocument()
    expect(screen.getByText("Second Episode")).toBeInTheDocument()
    expect(screen.getByText("Third Episode")).toBeInTheDocument()
    // The now-playing episode should not be duplicated in the latest list.
    expect(screen.queryAllByText("First Episode")).toHaveLength(1)
  })

  it("does not render 'Now Playing' when there are no episodes", async () => {
    delete process.env[ENV_KEY]
    setupApis({ episodes: [], totalEpisodes: 0 })

    renderWithProviders(<PodcastsListingPage />)

    // Wait for loading to settle (the empty state replaces the skeleton).
    await screen.findByText("No episodes available right now.")
    expect(screen.queryByText("NOW PLAYING")).not.toBeInTheDocument()
  })

  it("shows 'Load more episodes' only when more episodes are available", async () => {
    delete process.env[ENV_KEY]
    const episodes = [makeEpisode({ title: "Only Episode" })]
    setupApis({ episodes, totalEpisodes: 5 })

    renderWithProviders(<PodcastsListingPage />)

    expect(
      await screen.findByRole("link", { name: /load more episodes/i }),
    ).toBeInTheDocument()
  })

  it("does not render the featured podcasts section when the env var is unset", async () => {
    delete process.env[ENV_KEY]
    setupApis({ podcasts: [makePodcast({ title: "Regular Podcast" })] })

    renderWithProviders(<PodcastsListingPage />)

    await screen.findByText("Regular Podcast")
    expect(screen.queryByText("FEATURED")).not.toBeInTheDocument()
  })

  it("renders featured podcasts from the configured learning path", async () => {
    process.env[ENV_KEY] = "99"
    setupApis({
      featuredLearningPathId: 99,
      featuredPodcast: [makePodcast({ title: "Featured Podcast" })],
    })

    renderWithProviders(<PodcastsListingPage />)

    expect(await screen.findByText("Featured Podcast")).toBeInTheDocument()
    expect(screen.getByText("FEATURED")).toBeInTheDocument()
  })

  it("does not repeat a featured podcast in the 'More Podcasts' list", async () => {
    process.env[ENV_KEY] = "99"
    const shared = makePodcast({ id: 42, title: "Shared Podcast" })
    const other = makePodcast({ id: 7, title: "Another Podcast" })
    setupApis({
      // The shared podcast is both featured and among the newest podcasts.
      podcasts: [shared, other],
      totalPodcasts: 2,
      featuredLearningPathId: 99,
      featuredPodcast: [shared],
    })

    renderWithProviders(<PodcastsListingPage />)

    // Featured + More list should render the shared podcast exactly once.
    await screen.findByText("Another Podcast")
    expect(screen.getAllByText("Shared Podcast")).toHaveLength(1)
  })

  it("plays an episode and toggles the button to 'Pause' once playback starts", async () => {
    delete process.env[ENV_KEY]
    const episode = makeEpisode({
      title: "Playable Episode",
      // The producing org differs from the show name, to prove the player uses
      // the parent podcast title rather than `offered_by`.
      offered_by: { name: "MIT OpenCourseWare", code: "ocw" },
      podcast_episode: {
        id: 1,
        podcasts: [1],
        parent_podcasts: [
          { id: 1, title: "The Show Name", readable_id: "the-show" },
        ],
        duration: "PT1M",
        audio_url: "https://example.com/audio.mp3",
        episode_link: "",
      },
    })
    setupApis({ episodes: [episode], totalEpisodes: 1 })

    renderWithProviders(<PodcastsListingPage />)

    const playButton = await screen.findByRole("button", {
      name: "Play episode",
    })
    await user.click(playButton)

    await waitFor(() =>
      expect(screen.getByTestId("player-track-title")).toHaveTextContent(
        "Playable Episode",
      ),
    )
    // The player shows the parent podcast series title, not `offered_by.name`.
    expect(screen.getByTestId("player-podcast-name")).toHaveTextContent(
      "The Show Name",
    )
    expect(
      await screen.findByRole("button", { name: "Pause episode" }),
    ).toBeInTheDocument()
  })

  it("renders error states when the episode and podcast requests fail", async () => {
    delete process.env[ENV_KEY]
    setMockResponse.get(
      urls.learningResources.list({
        resource_type: [ResourceTypeEnum.PodcastEpisode],
        sortby: LearningResourcesListSortbyEnum.New,
        limit: EPISODES_PAGE_SIZE + 1,
      }),
      "Server error",
      { code: 500 },
    )
    setMockResponse.get(
      urls.learningResources.list({
        resource_type: [ResourceTypeEnum.Podcast],
        sortby: LearningResourcesListSortbyEnum.New,
        limit: PODCAST_MORE_COUNT,
      }),
      "Server error",
      { code: 500 },
    )

    renderWithProviders(<PodcastsListingPage />)

    expect(
      await screen.findByText(
        "Something went wrong loading episodes. Please try again later.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Something went wrong loading podcasts. Please try again later.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("NOW PLAYING")).not.toBeInTheDocument()
  })

  it("renders a meaningful, well-nested heading hierarchy", async () => {
    delete process.env[ENV_KEY]
    const episodes = [
      makeEpisode({ title: "First Episode" }),
      makeEpisode({
        title: "Second Episode",
        podcast_episode: {
          id: 2,
          podcasts: [1],
          duration: "PT1M",
          audio_url: "https://example.com/2.mp3",
          episode_link: "",
        },
      }),
    ]
    const podcasts = [makePodcast({ title: "Regular Podcast" })]
    setupApis({
      episodes,
      totalEpisodes: episodes.length,
      podcasts,
      totalPodcasts: podcasts.length,
    })

    renderWithProviders(<PodcastsListingPage />)

    // Wait for the async sections to render before asserting the hierarchy.
    await screen.findByText("First Episode")

    // Section headings only; Typography variants (h4/h5/h6) are excluded.
    assertHeadings(
      [
        { level: 1, name: "Podcasts from across MIT" },
        { level: 2, name: "First Episode" },
        { level: 2, name: "Latest Episodes" },
        { level: 2, name: "Podcasts across MIT" },
        { level: 2, name: "More Podcasts" },
      ],
      { maxLevel: 2 },
    )
  })
})
