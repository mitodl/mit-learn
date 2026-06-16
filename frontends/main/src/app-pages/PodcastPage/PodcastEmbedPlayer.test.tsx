import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ThemeProvider } from "ol-components"
import { factories } from "api/test-utils"
import type { LearningResource, PodcastEpisodeResource } from "api/v1"
import PodcastEmbedPlayer from "./PodcastEmbedPlayer"

// JSDOM does not implement HTMLMediaElement methods; provide minimal stubs.
beforeAll(() => {
  window.HTMLMediaElement.prototype.load = jest.fn()
  window.HTMLMediaElement.prototype.play = jest
    .fn()
    .mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = jest.fn()
})

afterEach(() => {
  jest.clearAllMocks()
})

const makeEpisode = (
  overrides: Partial<PodcastEpisodeResource> = {},
): PodcastEpisodeResource =>
  factories.learningResources.podcastEpisode(overrides)

const renderPlayer = async (
  resource: LearningResource = makeEpisode(),
  options: { waitForAutoPlay?: boolean } = {},
) => {
  const { waitForAutoPlay = true } = options
  const view = render(
    <ThemeProvider>
      <PodcastEmbedPlayer resource={resource} />
    </ThemeProvider>,
  )
  if (waitForAutoPlay) {
    await waitFor(() =>
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    )
  }
  const audio = document.querySelector("audio") as HTMLAudioElement
  const simulateCanPlay = () => fireEvent.canPlay(audio)
  const simulateLoadedMetadata = (duration: number) => {
    Object.defineProperty(audio, "duration", {
      value: duration,
      configurable: true,
    })
    fireEvent.loadedMetadata(audio)
  }
  return { ...view, audio, simulateCanPlay, simulateLoadedMetadata }
}

describe("PodcastEmbedPlayer", () => {
  describe("metadata display", () => {
    test("renders episode title", async () => {
      const resource = makeEpisode({ title: "Deep Dive Episode" })
      await renderPlayer(resource)
      expect(screen.getByText("Deep Dive Episode")).toBeInTheDocument()
    })

    test("renders offered_by name as podcast label", async () => {
      const resource = makeEpisode({
        offered_by: {
          channel_url: "https://example.com/channel",
          code: "mitx",
          name: "MITx",
        },
      })
      await renderPlayer(resource)
      expect(screen.getByText("MITx")).toBeInTheDocument()
    })

    test('falls back to "Podcast" when offered_by is null', async () => {
      const resource = makeEpisode({ offered_by: null })
      await renderPlayer(resource)
      expect(screen.getByText("Podcast")).toBeInTheDocument()
    })

    test("renders cover art when image URL is present", async () => {
      const resource = makeEpisode({
        image: {
          id: 1,
          url: "https://example.com/cover.jpg",
          alt: "Cover art",
        },
      })
      await renderPlayer(resource)
      const img = screen.getByRole("img", { name: /cover art/i })
      expect(img).toHaveAttribute("src", "https://example.com/cover.jpg")
    })

    test("renders placeholder when image URL is absent", async () => {
      const resource = makeEpisode({ image: null })
      await renderPlayer(resource)
      expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
  })

  describe("audio source", () => {
    test("audio element src uses audio_url", async () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: "https://cdn.example.com/ep.mp3",
          episode_link: "https://example.com/episode",
        },
      })
      const { audio } = await renderPlayer(resource)
      expect(audio).toHaveAttribute("src", "https://cdn.example.com/ep.mp3")
    })

    test("falls back to episode_link when audio_url is absent", async () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: null as unknown as string,
          episode_link: "https://example.com/fallback.mp3",
        },
      })
      const { audio } = await renderPlayer(resource)
      expect(audio).toHaveAttribute("src", "https://example.com/fallback.mp3")
    })

    test("audio element has no src when resource is not a podcast episode", async () => {
      const resource = factories.learningResources.course() as LearningResource
      const { audio } = await renderPlayer(resource, {
        waitForAutoPlay: false,
      })
      expect(audio).not.toHaveAttribute("src")
    })
  })

  describe("play/pause", () => {
    test("auto-plays on mount", async () => {
      await renderPlayer()
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
    })

    test("shows loading state initially", async () => {
      await renderPlayer()
      // canPlay has not fired yet — still buffering
      expect(screen.getByRole("button", { name: /^loading$/i })).toBeDisabled()
    })

    test("enables play/pause button after canPlay fires", async () => {
      const { simulateCanPlay } = await renderPlayer()
      simulateCanPlay()
      expect(
        screen.getByRole("button", { name: /^pause$/i }),
      ).not.toBeDisabled()
    })

    test("clicking Pause calls audio.pause() and shows Play", async () => {
      const { simulateCanPlay } = await renderPlayer()
      simulateCanPlay()
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }))
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
      expect(
        screen.getByRole("button", { name: /^play$/i }),
      ).toBeInTheDocument()
    })

    test("clicking Play after pause calls audio.play()", async () => {
      const { simulateCanPlay } = await renderPlayer()
      simulateCanPlay()
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }))
      jest.clearAllMocks()
      fireEvent.click(screen.getByRole("button", { name: /^play$/i }))
      await waitFor(() =>
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
      )
    })

    test("shows Play unavailable and is disabled when there is no audio source", async () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: null as unknown as string,
          episode_link: null,
        },
      })
      await renderPlayer(resource, { waitForAutoPlay: false })
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
      expect(
        screen.getByRole("button", { name: /play unavailable/i }),
      ).toBeDisabled()
    })

    test("prevents duplicate play calls while play is pending", async () => {
      const { simulateCanPlay } = await renderPlayer()
      simulateCanPlay()
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }))
      jest.clearAllMocks()

      let resolvePlay: (() => void) | undefined
      const pendingPlay = new Promise<void>((resolve) => {
        resolvePlay = resolve
      })
      ;(window.HTMLMediaElement.prototype.play as jest.Mock).mockImplementation(
        () => pendingPlay,
      )

      const playBtn = screen.getByRole("button", { name: /^play$/i })
      fireEvent.click(playBtn)
      fireEvent.click(playBtn)

      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("button", { name: /^loading$/i })).toBeDisabled()

      resolvePlay?.()
      await screen.findByRole("button", { name: /^pause$/i })
    })
  })

  describe("skip controls", () => {
    test("rewind button subtracts 10s from currentTime", async () => {
      const { audio, simulateCanPlay, simulateLoadedMetadata } =
        await renderPlayer()
      simulateLoadedMetadata(120)
      simulateCanPlay()
      Object.defineProperty(audio, "currentTime", {
        value: 60,
        configurable: true,
        writable: true,
      })
      fireEvent.click(
        screen.getByRole("button", { name: /rewind 10 seconds/i }),
      )
      expect(audio.currentTime).toBe(50)
    })

    test("forward button adds 30s to currentTime", async () => {
      const { audio, simulateCanPlay, simulateLoadedMetadata } =
        await renderPlayer()
      simulateLoadedMetadata(120)
      simulateCanPlay()
      Object.defineProperty(audio, "currentTime", {
        value: 60,
        configurable: true,
        writable: true,
      })
      fireEvent.click(
        screen.getByRole("button", { name: /forward 30 seconds/i }),
      )
      expect(audio.currentTime).toBe(90)
    })

    test("rewind clamps to 0", async () => {
      const { audio, simulateCanPlay, simulateLoadedMetadata } =
        await renderPlayer()
      simulateLoadedMetadata(120)
      simulateCanPlay()
      Object.defineProperty(audio, "currentTime", {
        value: 5,
        configurable: true,
        writable: true,
      })
      fireEvent.click(
        screen.getByRole("button", { name: /rewind 10 seconds/i }),
      )
      expect(audio.currentTime).toBe(0)
    })

    test("forward clamps to duration", async () => {
      const { audio, simulateCanPlay, simulateLoadedMetadata } =
        await renderPlayer()
      simulateLoadedMetadata(120)
      simulateCanPlay()
      Object.defineProperty(audio, "currentTime", {
        value: 110,
        configurable: true,
        writable: true,
      })
      fireEvent.click(
        screen.getByRole("button", { name: /forward 30 seconds/i }),
      )
      expect(audio.currentTime).toBe(120)
    })
  })

  describe("speed control", () => {
    test("initial speed label is 1x", async () => {
      await renderPlayer()
      expect(
        screen.getByRole("button", { name: /playback speed/i }),
      ).toHaveTextContent("1x")
    })

    test("cycles through speed options on click", async () => {
      await renderPlayer()
      const btn = screen.getByRole("button", { name: /playback speed/i })
      fireEvent.click(btn)
      expect(btn).toHaveTextContent("1.25x")
      fireEvent.click(btn)
      expect(btn).toHaveTextContent("1.5x")
      fireEvent.click(btn)
      expect(btn).toHaveTextContent("2x")
      fireEvent.click(btn)
      expect(btn).toHaveTextContent("0.75x")
    })

    test("cycling speed applies playbackRate to audio element", async () => {
      const { audio } = await renderPlayer()
      fireEvent.click(screen.getByRole("button", { name: /playback speed/i }))
      expect(audio.playbackRate).toBe(1.25)
    })
  })

  describe("seek slider", () => {
    test("dragging the slider updates audio currentTime", async () => {
      const { audio, simulateCanPlay, simulateLoadedMetadata } =
        await renderPlayer()
      simulateLoadedMetadata(200)
      simulateCanPlay()
      const slider = screen.getByRole("slider", { name: /seek/i })
      fireEvent.change(slider, { target: { value: "90" } })
      expect(audio.currentTime).toBe(90)
    })
  })

  describe("no close button", () => {
    test("does not render a close button", async () => {
      await renderPlayer()
      expect(
        screen.queryByRole("button", { name: /close/i }),
      ).not.toBeInTheDocument()
    })
  })
})
