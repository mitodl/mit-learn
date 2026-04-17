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
    // Both desktop and mobile render the same text so we use getAllBy
    expect(screen.getAllByText("My Episode").length).toBeGreaterThan(0)
    expect(screen.getAllByText("My Podcast").length).toBeGreaterThan(0)
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
    // isPlaying=true after auto-play resolves, but isBuffering is still true,
    // so both buttons should show "Pause" (the buffering label is "Loading")
    // The buttons are disabled while buffering regardless of isPlaying.
    const allButtons = screen.getAllByRole("button")
    const playPauseButtons = allButtons.filter(
      (b) => b.getAttribute("aria-label") === "Loading",
    )
    expect(playPauseButtons.length).toBeGreaterThan(0)
    playPauseButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  test("enables play/pause button after canplay fires", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    // isPlaying=true from auto-play, so after canPlay we expect Pause buttons
    const pauseButtons = screen.getAllByRole("button", { name: /^pause$/i })
    expect(pauseButtons.length).toBeGreaterThan(0)
    pauseButtons.forEach((btn) => expect(btn).not.toBeDisabled())
  })

  test("plays automatically on mount", async () => {
    await renderPlayer()
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  test("clicking Pause calls audio.pause() and shows Play", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    const [pauseBtn] = screen.getAllByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    expect(
      screen.getAllByRole("button", { name: /^play$/i }).length,
    ).toBeGreaterThan(0)
  })

  test("clicking Play again calls audio.play()", async () => {
    const { simulateCanPlay } = await renderPlayer()
    await simulateCanPlay()
    const [pauseBtn] = screen.getAllByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    jest.clearAllMocks()
    const [playBtn] = screen.getAllByRole("button", { name: /^play$/i })
    fireEvent.click(playBtn)
    await waitFor(() =>
      expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    )
  })

  test("calls onClose when close button is clicked", async () => {
    const { onClose } = await renderPlayer()
    fireEvent.click(screen.getAllByRole("button", { name: /close player/i })[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("cycles through speed options and updates label", async () => {
    await renderPlayer()
    // Initial speed label is 1x (index 1 of [0.75, 1, 1.25, 1.5, 2])
    expect(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    ).toHaveTextContent("1x")

    fireEvent.click(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    )
    expect(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    ).toHaveTextContent("1.25x")

    fireEvent.click(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    )
    expect(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    ).toHaveTextContent("1.5x")
  })

  test("cycling speed applies playbackRate to audio element", async () => {
    const { audio } = await renderPlayer()
    fireEvent.click(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    )
    expect(audio.playbackRate).toBe(1.25)
  })

  test("speed is reapplied to new track (playbackRate preserved on track change)", async () => {
    const { rerender, audio } = await renderPlayer()

    // Cycle to 1.5x
    fireEvent.click(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    ) // 1.25x
    fireEvent.click(
      screen.getAllByRole("button", { name: /playback speed/i })[0],
    ) // 1.5x

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
    fireEvent.click(
      screen.getAllByRole("button", { name: /rewind 10 seconds/i })[0],
    )
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
    fireEvent.click(
      screen.getAllByRole("button", { name: /forward 30 seconds/i })[0],
    )
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
    fireEvent.click(
      screen.getAllByRole("button", { name: /rewind 10 seconds/i })[0],
    )
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
    fireEvent.click(
      screen.getAllByRole("button", { name: /forward 30 seconds/i })[0],
    )
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
    const sliders = screen.getAllByRole("slider", { name: /seek/i })
    fireEvent.keyDown(sliders[0], { key: "ArrowRight" })
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
    const sliders = screen.getAllByRole("slider", { name: /seek/i })
    fireEvent.keyDown(sliders[0], { key: "ArrowLeft" })
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
    const [pauseBtn] = screen.getAllByRole("button", { name: /^pause$/i })
    fireEvent.click(pauseBtn)
    expect(onPlayStateChange).toHaveBeenCalledWith(false)
  })
})
