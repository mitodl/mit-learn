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

const renderPlayer = (resource: LearningResource = makeEpisode()) => {
  const view = render(
    <ThemeProvider>
      <PodcastEmbedPlayer resource={resource} />
    </ThemeProvider>,
  )
  const audio = document.querySelector("audio") as HTMLAudioElement
  const simulateLoadedMetadata = (duration: number) => {
    Object.defineProperty(audio, "duration", {
      value: duration,
      configurable: true,
    })
    fireEvent.loadedMetadata(audio)
  }
  return { ...view, audio, simulateLoadedMetadata }
}

describe("PodcastEmbedPlayer", () => {
  describe("metadata display", () => {
    test("renders episode title", () => {
      const resource = makeEpisode({ title: "Deep Dive Episode" })
      renderPlayer(resource)
      expect(screen.getByText("Deep Dive Episode")).toBeInTheDocument()
    })

    test("renders offered_by name as podcast label", () => {
      const resource = makeEpisode({
        offered_by: {
          channel_url: "https://example.com/channel",
          code: "mitx",
          name: "MITx",
        },
      })
      renderPlayer(resource)
      expect(screen.getByText("MITx")).toBeInTheDocument()
    })

    test('falls back to "Podcast" when offered_by is null', () => {
      const resource = makeEpisode({ offered_by: null })
      renderPlayer(resource)
      expect(screen.getByText("Podcast")).toBeInTheDocument()
    })

    test("renders cover art when image URL is present", () => {
      const resource = makeEpisode({
        image: {
          id: 1,
          url: "https://example.com/cover.jpg",
          alt: "Cover art",
        },
      })
      renderPlayer(resource)
      const img = screen.getByRole("img", { name: /cover art/i })
      expect(img).toHaveAttribute("src", "https://example.com/cover.jpg")
    })

    test("renders placeholder when image URL is absent", () => {
      const resource = makeEpisode({ image: null })
      renderPlayer(resource)
      expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
  })

  describe("audio source", () => {
    test("audio element src uses audio_url", () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: "https://cdn.example.com/ep.mp3",
          episode_link: "https://example.com/episode",
        },
      })
      const { audio } = renderPlayer(resource)
      expect(audio).toHaveAttribute("src", "https://cdn.example.com/ep.mp3")
    })

    test("does not use episode_link as audio src when audio_url is absent", () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: null as unknown as string,
          episode_link: "https://example.com/webpage",
        },
      })
      const { audio } = renderPlayer(resource)
      expect(audio).not.toHaveAttribute("src")
    })

    test("audio element has no src when resource is not a podcast episode", () => {
      const resource = factories.learningResources.course() as LearningResource
      const { audio } = renderPlayer(resource)
      expect(audio).not.toHaveAttribute("src")
    })
  })

  describe("play/pause", () => {
    test("does not auto-play on mount", () => {
      renderPlayer()
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    })

    test("shows enabled Play button on mount", () => {
      renderPlayer()
      const btn = screen.getByRole("button", { name: /^play$/i })
      expect(btn).not.toBeDisabled()
    })

    test("clicking Play calls audio.play() and shows Pause", async () => {
      renderPlayer()
      fireEvent.click(screen.getByRole("button", { name: /^play$/i }))
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
      await screen.findByRole("button", { name: /^pause$/i })
    })

    test("clicking Pause calls audio.pause() and shows Play", async () => {
      renderPlayer()
      fireEvent.click(screen.getByRole("button", { name: /^play$/i }))
      await screen.findByRole("button", { name: /^pause$/i })
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }))
      expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
      expect(
        screen.getByRole("button", { name: /^play$/i }),
      ).toBeInTheDocument()
    })

    test("clicking Play after pause calls audio.play()", async () => {
      renderPlayer()
      fireEvent.click(screen.getByRole("button", { name: /^play$/i }))
      await screen.findByRole("button", { name: /^pause$/i })
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }))
      jest.clearAllMocks()
      fireEvent.click(screen.getByRole("button", { name: /^play$/i }))
      await waitFor(() =>
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
      )
    })

    test("shows Play unavailable and is disabled when there is no audio source", () => {
      const resource = makeEpisode({
        podcast_episode: {
          ...makeEpisode().podcast_episode!,
          audio_url: null as unknown as string,
          episode_link: null,
        },
      })
      renderPlayer(resource)
      expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
      expect(
        screen.getByRole("button", { name: /play unavailable/i }),
      ).toBeDisabled()
    })

    test("prevents duplicate play calls while play is pending", async () => {
      renderPlayer()

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
    test("rewind button subtracts 10s from currentTime", () => {
      const { audio, simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(120)
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

    test("forward button adds 30s to currentTime", () => {
      const { audio, simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(120)
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

    test("rewind clamps to 0", () => {
      const { audio, simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(120)
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

    test("forward clamps to duration", () => {
      const { audio, simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(120)
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
    test("initial speed label is 1x", () => {
      renderPlayer()
      expect(
        screen.getByRole("button", { name: /playback speed/i }),
      ).toHaveTextContent("1x")
    })

    test("cycles through speed options on click", () => {
      renderPlayer()
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

    test("cycling speed applies playbackRate to audio element", () => {
      const { audio } = renderPlayer()
      fireEvent.click(screen.getByRole("button", { name: /playback speed/i }))
      expect(audio.playbackRate).toBe(1.25)
    })
  })

  describe("time display", () => {
    test("formats duration under 60 minutes as MM:SS", () => {
      const { simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(125) // 2:05
      expect(screen.getAllByText("02:05")[0]).toBeInTheDocument()
    })

    test("formats duration of 60 minutes or more as H:MM:SS", () => {
      const { simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(3661) // 1:01:01
      expect(screen.getAllByText("1:01:01")[0]).toBeInTheDocument()
    })
  })

  describe("seek slider", () => {
    test("dragging the slider updates audio currentTime", () => {
      const { audio, simulateLoadedMetadata } = renderPlayer()
      simulateLoadedMetadata(200)
      const slider = screen.getByRole("slider", { name: /seek/i })
      fireEvent.change(slider, { target: { value: "90" } })
      expect(audio.currentTime).toBe(90)
    })
  })

  describe("no close button", () => {
    test("does not render a close button", () => {
      renderPlayer()
      expect(
        screen.queryByRole("button", { name: /close/i }),
      ).not.toBeInTheDocument()
    })
  })
})
