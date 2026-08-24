import React from "react"
import { factories, setMockResponse, urls } from "api/test-utils"
import { ResourceTypeEnum } from "api/v1"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import { renderWithProviders, screen, user, waitFor } from "@/test-utils"
import { PodcastEpisodeDetailPage } from "./PodcastEpisodeDetailPage"

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
  /**
   * When set, the episode reports has_transcript and the transcript endpoint
   * returns this text. Paragraphs are separated by a blank line, as the ETL
   * normalizer emits them.
   */
  transcript?: string
  /** Report has_transcript, but leave the transcript request in flight. */
  transcriptPending?: boolean
  /** Report has_transcript, but fail the transcript request. */
  transcriptFails?: boolean
}

const setupApis = ({
  episodeOverrides = {},
  podcastOverrides = {},
  moreEpisodes,
  transcript,
  transcriptPending = false,
  transcriptFails = false,
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
      has_transcript:
        transcript !== undefined || transcriptPending || transcriptFails,
      ...episodeOverridesEpisode,
    },
  } as Partial<LearningResource>)

  if (transcript !== undefined) {
    setMockResponse.get(urls.podcastEpisodes.transcript(episode.id), {
      id: episode.id,
      transcript,
    })
  }
  if (transcriptPending) {
    // A promise that never settles keeps the query in its loading state.
    setMockResponse.get(
      urls.podcastEpisodes.transcript(episode.id),
      new Promise(() => {}),
    )
  }
  if (transcriptFails) {
    setMockResponse.get(
      urls.podcastEpisodes.transcript(episode.id),
      "Server error",
      { code: 500 },
    )
  }

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
    // The resource factory leaves last_modified unset, and the JSON-LD is
    // omitted without it.
    episode.last_modified = "2026-01-02T03:04:05Z"
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

    // So must the JSON-LD: partOfSeries takes its url from the podcast in the
    // current route, so taking the name from parent_podcasts[0] instead would
    // publish Podcast A's name against Podcast B's url.
    const jsonLd = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')!.innerHTML,
    )
    expect(jsonLd.partOfSeries).toEqual(
      expect.objectContaining({
        "@type": "PodcastSeries",
        name: "Podcast B",
        url: expect.stringContaining(`/podcast/${podcastB.id}/`),
      }),
    )
  })

  test("escapes every < in the JSON-LD, not just </", async () => {
    // Episode titles come straight from third-party RSS with no sanitization
    // (podcast.transform_episode reads rss_data.title.text verbatim). Escaping
    // only `</` stops `</script>` but not `<!--<script>`, which puts the HTML
    // parser into the script-data-escaped state it then never leaves,
    // swallowing the rest of the document.
    const hostileTitle = "Ep 1 <!--<script>alert(1)</script>"
    const { episode, podcast } = setupApis({
      moreEpisodes: [],
      episodeOverrides: {
        title: hostileTitle,
        last_modified: "2026-01-02T03:04:05Z",
      },
    })
    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    // The JSON-LD renders once the episode query resolves.
    await waitFor(() =>
      expect(
        document.querySelector('script[type="application/ld+json"]'),
      ).toBeInTheDocument(),
    )
    const script = document.querySelector('script[type="application/ld+json"]')!
    // No raw "<" survives into the script element's text.
    expect(script.innerHTML).not.toContain("<")
    expect(script.innerHTML).toContain("\\u003c")
    // ...and the payload is still valid JSON carrying the real title.
    expect(JSON.parse(script.innerHTML).name).toBe(hostileTitle)
  })

  test("shows a loading skeleton while the episode is fetching", async () => {
    const { episode, podcast } = setupApis({ moreEpisodes: [] })

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    // Skeleton is visible on first paint, before the query resolves.
    expect(screen.getByTestId("episode-header-skeleton")).toBeInTheDocument()

    // Flush to the loaded state to avoid act() warnings.
    await screen.findAllByText(episode.title!)
  })

  test("shows an error message when the episode fails to load", async () => {
    const episode = makePodcastEpisode()
    const podcast = makePodcast()
    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      "Server error",
      { code: 500 },
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    expect(
      await screen.findByText(/something went wrong loading this episode/i),
    ).toBeInTheDocument()
  })

  test("shows an unavailable message when the episode is missing", async () => {
    const episode = makePodcastEpisode()
    const podcast = makePodcast()
    setMockResponse.get(
      urls.learningResources.details({ id: episode.id }),
      null,
    )
    setMockResponse.get(
      `${urls.learningResources.items({ id: podcast.id })}?limit=${EPISODES_PAGE_SIZE}`,
      makeItemsResponse([]),
    )

    renderWithProviders(
      <PodcastEpisodeDetailPage
        episodeId={String(episode.id)}
        podcastId={String(podcast.id)}
      />,
    )

    expect(
      await screen.findByText(/this episode is unavailable/i),
    ).toBeInTheDocument()
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

  describe("Description / Transcript tabs", () => {
    const TRANSCRIPT =
      "Host: Welcome back to the show.\n\nGuest: Thanks for having me."

    const renderPage = (opts: SetupOptions) => {
      const { episode, podcast } = setupApis({ moreEpisodes: [], ...opts })
      renderWithProviders(
        <PodcastEpisodeDetailPage
          episodeId={String(episode.id)}
          podcastId={String(podcast.id)}
        />,
      )
      return { episode, podcast }
    }

    test("shows no tablist when the episode has no transcript", async () => {
      renderPage({
        episodeOverrides: { description: "Just a description." },
      })

      // findAllByText: the episode title renders twice, in the breadcrumb and
      // as the h1.
      await screen.findByText("Just a description.")
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    })

    test("shows no tablist when there is a transcript but no description", async () => {
      // Tabs would open on an empty Description panel, so the transcript
      // stands alone instead.
      renderPage({
        episodeOverrides: { description: "" },
        transcript: TRANSCRIPT,
      })

      await screen.findByText("Host: Welcome back to the show.")
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    })

    test("defaults to the Description tab", async () => {
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcript: TRANSCRIPT,
      })

      const description = await screen.findByRole("tab", {
        name: "Description",
      })
      expect(description).toHaveAttribute("aria-selected", "true")
      expect(screen.getByRole("tab", { name: "Transcript" })).toHaveAttribute(
        "aria-selected",
        "false",
      )
    })

    test("keeps both panels in the DOM, toggling only `hidden`", async () => {
      // This is what keeps the transcript crawlable: search engines index DOM
      // content hidden with `hidden`, but never content that appears only
      // after a click. A conditional mount would silently break it.
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcript: TRANSCRIPT,
      })

      // Waits for the transcript text, not just the tab: the tablist now
      // appears as soon as the episode reports a transcript, so the tab is
      // present while the request is still in flight.
      await screen.findByText("Host: Welcome back to the show.")
      const panels = document.querySelectorAll('[role="tabpanel"]')
      expect(panels).toHaveLength(2)

      const [descriptionPanel, transcriptPanel] = Array.from(panels)
      expect(descriptionPanel).not.toHaveAttribute("hidden")
      expect(transcriptPanel).toHaveAttribute("hidden")

      // The inactive panel's text is present in the DOM, not merely mounted.
      expect(transcriptPanel).toHaveTextContent("Welcome back to the show.")
      expect(transcriptPanel).toHaveTextContent("Thanks for having me.")

      await user.click(screen.getByRole("tab", { name: "Transcript" }))

      expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(2)
      expect(descriptionPanel).toHaveAttribute("hidden")
      expect(transcriptPanel).not.toHaveAttribute("hidden")
      expect(descriptionPanel).toHaveTextContent("Just a description.")
    })

    test("moves focus between tabs with arrow keys, activating on Enter", async () => {
      // The WAI-ARIA APG manual-activation pattern, which is MUI's default and
      // what every other tabset in this app uses: arrows move focus, Enter or
      // Space selects. (Automatic activation would need
      // selectionFollowsFocus on the TabButtonList.)
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcript: TRANSCRIPT,
      })

      const description = await screen.findByRole("tab", {
        name: "Description",
      })
      const transcript = screen.getByRole("tab", { name: "Transcript" })

      description.focus()
      await user.keyboard("{ArrowRight}")
      expect(transcript).toHaveFocus()
      expect(description).toHaveAttribute("aria-selected", "true")

      await user.keyboard("{Enter}")
      expect(transcript).toHaveAttribute("aria-selected", "true")
      expect(description).toHaveAttribute("aria-selected", "false")

      await user.keyboard("{ArrowLeft}")
      expect(description).toHaveFocus()
      await user.keyboard("{Enter}")
      expect(description).toHaveAttribute("aria-selected", "true")
    })

    test("exposes a roving tab stop across the tablist", async () => {
      // Only the selected tab is reachable by Tab; the others are -1 so the
      // whole tablist is one stop, per the APG pattern.
      renderPage({ transcript: TRANSCRIPT })

      const description = await screen.findByRole("tab", {
        name: "Description",
      })
      const transcript = screen.getByRole("tab", { name: "Transcript" })
      expect(description).toHaveAttribute("tabindex", "0")
      expect(transcript).toHaveAttribute("tabindex", "-1")
    })

    test("renders transcript paragraphs as escaped text, not HTML", async () => {
      // The description is nh3-sanitized during ETL; the transcript is
      // third-party text that was never sanitized for markup, so it must stay
      // escaped.
      renderPage({
        transcript: "Host: <img src=x onerror=alert(1)> and <b>bold</b>.",
      })

      const transcriptTab = await screen.findByRole("tab", {
        name: "Transcript",
      })
      await user.click(transcriptTab)

      const panel = screen.getByRole("tabpanel", { name: "Transcript" })
      expect(panel).toHaveTextContent("<img src=x onerror=alert(1)>")
      expect(panel.querySelector("img")).toBeNull()
      expect(panel.querySelector("b")).toBeNull()
    })

    test("shows the tablist with a busy panel while the transcript loads", async () => {
      // The tablist appears as soon as the episode reports a transcript, not
      // when the text lands, so the tab set does not shift under someone
      // already reading the description.
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcriptPending: true,
      })

      const transcriptTab = await screen.findByRole("tab", {
        name: "Transcript",
      })
      await user.click(transcriptTab)

      const panel = screen.getByRole("tabpanel", { name: "Transcript" })
      expect(panel).toHaveAttribute("aria-busy", "true")
      expect(screen.getByTestId("transcript-skeleton")).toBeInTheDocument()
      // The live region carries the outcome for screen reader users.
      expect(screen.getByRole("status")).toHaveTextContent("Loading transcript")
      // Nothing to reach by keyboard yet, so the panel takes no tab stop.
      expect(panel).not.toHaveAttribute("tabindex")
    })

    test("says so when the transcript fails to load", async () => {
      // has_transcript is true and the JSON-LD advertises a transcript, so
      // dropping the tab silently would leave the claim unexplained.
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcriptFails: true,
      })

      await user.click(await screen.findByRole("tab", { name: "Transcript" }))

      const panel = screen.getByRole("tabpanel", { name: "Transcript" })
      expect(panel).toHaveTextContent("The transcript could not be loaded.")
      expect(panel).toHaveAttribute("aria-busy", "false")
      expect(screen.getByRole("status")).toHaveTextContent(
        "The transcript could not be loaded.",
      )
    })

    test("withdraws the tablist when the endpoint returns an empty transcript", async () => {
      // The endpoint is cached, so an episode whose transcript landed after
      // something first requested it serves "" for a while. That is nothing to
      // show, not a load that never finishes -- the tab appears on the
      // episode's has_transcript and then withdraws, rather than leaving a
      // skeleton that never resolves.
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcript: "",
      })

      await screen.findByRole("tab", { name: "Transcript" })
      await waitFor(() =>
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument(),
      )
      expect(
        screen.queryByTestId("transcript-skeleton"),
      ).not.toBeInTheDocument()
      expect(screen.getByText("Just a description.")).toBeInTheDocument()
    })

    test("puts the tab stop on the panel, not on a child", async () => {
      // WAI-ARIA APG: the tabpanel itself is the focusable element, so focus
      // lands with the panel's role and name announced. A focusable inner div
      // would announce only raw text.
      renderPage({
        episodeOverrides: { description: "Just a description." },
        transcript: TRANSCRIPT,
      })

      await user.click(await screen.findByRole("tab", { name: "Transcript" }))

      const panel = screen.getByRole("tabpanel", { name: "Transcript" })
      expect(panel).toHaveAttribute("tabindex", "0")
      expect(panel.querySelectorAll("[tabindex]")).toHaveLength(0)

      await user.tab()
      expect(panel).toHaveFocus()
    })

    test("splits the transcript into one paragraph per turn", async () => {
      renderPage({ transcript: TRANSCRIPT })

      // The panel has to be activated before querying it by role: a `hidden`
      // panel is excluded from the accessibility tree, so getByRole cannot see
      // it even though it is in the DOM.
      await user.click(await screen.findByRole("tab", { name: "Transcript" }))

      const panel = screen.getByRole("tabpanel", { name: "Transcript" })
      const paragraphs = panel.querySelectorAll("p")
      expect(paragraphs).toHaveLength(2)
      expect(paragraphs[0]).toHaveTextContent("Host: Welcome back to the show.")
      expect(paragraphs[1]).toHaveTextContent("Guest: Thanks for having me.")
    })
  })
})
