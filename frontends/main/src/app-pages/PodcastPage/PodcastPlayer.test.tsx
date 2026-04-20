import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ThemeProvider } from "ol-components"
import PodcastPlayer from "./PodcastPlayer"
import type { PodcastTrack } from "./PodcastPlayer"

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

const makeTrack = (overrides: Partial<PodcastTrack> = {}): PodcastTrack => ({
  audioUrl: "https://example.com/episode.mp3",
  title: "Episode One",
  podcastName: "The Test Podcast",
  ...overrides,
})

/**
 * Renders the player and flushes the initial auto-play promise so that the
 * setIsPlaying(true) state update inside play().then() is always wrapped in
 * act() before any assertion runs.
 */
const renderPlayer = async (
  track: PodcastTrack = makeTrack(),
  props: Partial<React.ComponentProps<typeof PodcastPlayer>> = {},
) => {
  const onClose = props.onClose ?? jest.fn()
  const view = render(
    <ThemeProvider>
      <PodcastPlayer track={track} onClose={onClose} {...props} />
    </ThemeProvider>,
  )
  // Wait until the auto-play play().then(setIsPlaying) microtask has resolved
  await waitFor(() =>
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
  )
  const audio = document.querySelector("audio") as HTMLAudioElement
  // Simulate the audio becoming ready to play
  const simulateCanPlay = () => fireEvent.canPlay(audio)
  const simulateLoadedMetadata = (duration: number) => {
    Object.defineProperty(audio, "duration", {
      value: duration,
      configurable: true,
    })
    fireEvent.loadedMetadata(audio)
  }
  return { ...view, audio, onClose, simulateCanPlay, simulateLoadedMetadata }
}

describe("PodcastPlayer", () => {
  test("renders track title and podcast name", async () => {
    await renderPlayer(
      makeTrack({ title: "My Episode", podcastName: "My Podcast" }),
    )
    expect(screen.getByText("My Episode")).toBeInTheDocument()
    expect(screen.getByText("My Podcast")).toBeInTheDocument()
  })

  test("renders the audio element with the correct src", async () => {
    const { audio } = await renderPlayer(
      makeTrack({ audioUrl: "https://cdn.example.com/ep.mp3" }),
    )
    expect(audio).toHaveAttribute("src", "https://cdn.example.com/ep.mp3")
  })

  test("shows loading state initially — play/pause buttons start disabled", async () => {
    // Render without flushing canPlay so buffering=true persists
    const onClose = jest.fn()
    render(
      <ThemeProvider>
        <PodcastPlayer track={makeTrack()} onClose={onClose} />
      </ThemeProvider>,
    )
    // Wait until the auto-play play().then(setIsPlaying) microtask has resolved
    await waitFor(() =>
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    )
    expect(screen.getByRole("button", { name: /^loading$/i })).toBeDisabled()
  })

  test("enables play/pause button after canplay fires", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    expect(screen.getByRole("button", { name: /^pause$/i })).not.toBeDisabled()
  })

  test("plays automatically on mount", async () => {
    await renderPlayer()
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  test("clicking Pause calls audio.pause() and shows Play", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    const pauseBtn = screen.getByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /^play$/i })).toBeInTheDocument()
  })

  test("clicking Play again calls audio.play()", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    const pauseBtn = screen.getByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    jest.clearAllMocks()
    const playBtn = screen.getByRole("button", { name: /^play$/i })
    fireEvent.click(playBtn)
    await waitFor(() =>
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    )
  })

  test("calls onClose when close button is clicked", async () => {
    const { onClose } = await renderPlayer()
    fireEvent.click(screen.getByRole("button", { name: /close player/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("cycles through speed options and updates label", async () => {
    await renderPlayer()
    // Initial speed label is 1x (index 1 of [0.75, 1, 1.25, 1.5, 2])
    expect(
      screen.getByRole("button", { name: /playback speed/i }),
    ).toHaveTextContent("1x")

    fireEvent.click(screen.getByRole("button", { name: /playback speed/i }))
    expect(
      screen.getByRole("button", { name: /playback speed/i }),
    ).toHaveTextContent("1.25x")

    fireEvent.click(screen.getByRole("button", { name: /playback speed/i }))
    expect(
      screen.getByRole("button", { name: /playback speed/i }),
    ).toHaveTextContent("1.5x")
  })

  test("cycling speed applies playbackRate to audio element", async () => {
    const { audio } = await renderPlayer()
    fireEvent.click(screen.getByRole("button", { name: /playback speed/i }))
    expect(audio.playbackRate).toBe(1.25)
  })

  test("speed is reapplied to new track (playbackRate preserved on track change)", async () => {
    const { rerender, audio } = await renderPlayer()

    // Cycle to 1.5x
    fireEvent.click(screen.getByRole("button", { name: /playback speed/i })) // 1.25x
    fireEvent.click(screen.getByRole("button", { name: /playback speed/i })) // 1.5x

    jest.clearAllMocks()

    // Change track — flush the new track-change effect
    rerender(
      <ThemeProvider>
        <PodcastPlayer
          track={makeTrack({ audioUrl: "https://example.com/ep2.mp3" })}
          onClose={jest.fn()}
        />
      </ThemeProvider>,
    )
    await waitFor(() => expect(audio.playbackRate).toBe(1.5))
  })

  test("rewind button subtracts 10s from currentTime", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 60,
      configurable: true,
      writable: true,
    })
    fireEvent.click(screen.getByRole("button", { name: /rewind 10 seconds/i }))
    expect(audio.currentTime).toBe(50)
  })

  test("forward button adds 30s to currentTime", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 60,
      configurable: true,
      writable: true,
    })
    fireEvent.click(screen.getByRole("button", { name: /forward 30 seconds/i }))
    expect(audio.currentTime).toBe(90)
  })

  test("rewind clamps to 0", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 5,
      configurable: true,
      writable: true,
    })
    fireEvent.click(screen.getByRole("button", { name: /rewind 10 seconds/i }))
    expect(audio.currentTime).toBe(0)
  })

  test("forward clamps to duration", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 110,
      configurable: true,
      writable: true,
    })
    fireEvent.click(screen.getByRole("button", { name: /forward 30 seconds/i }))
    expect(audio.currentTime).toBe(120)
  })

  test("seek slider keyboard ArrowRight skips forward 5s", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 40,
      configurable: true,
      writable: true,
    })
    const slider = screen.getByRole("slider", { name: /seek/i })
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(audio.currentTime).toBe(45)
  })

  test("seek slider keyboard ArrowLeft skips back 5s", async () => {
    const { audio, simulateCanPlay, simulateLoadedMetadata } =
      await renderPlayer()
    await simulateLoadedMetadata(120)
    await simulateCanPlay()
    Object.defineProperty(audio, "currentTime", {
      value: 40,
      configurable: true,
      writable: true,
    })
    const slider = screen.getByRole("slider", { name: /seek/i })
    fireEvent.keyDown(slider, { key: "ArrowLeft" })
    expect(audio.currentTime).toBe(35)
  })

  test("onPlayStateChange is called with true when playing starts", async () => {
    const onPlayStateChange = jest.fn()
    render(
      <ThemeProvider>
        <PodcastPlayer
          track={makeTrack()}
          onClose={jest.fn()}
          onPlayStateChange={onPlayStateChange}
        />
      </ThemeProvider>,
    )
    await waitFor(() => expect(onPlayStateChange).toHaveBeenCalledWith(true))
  })

  test("onPlayStateChange is called with false when paused", async () => {
    const onPlayStateChange = jest.fn()
    const { simulateCanPlay } = await renderPlayer(makeTrack(), {
      onPlayStateChange,
    })
    await simulateCanPlay()
    const pauseBtn = screen.getByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    expect(onPlayStateChange).toHaveBeenCalledWith(false)
  })
})
