import * as React from "react"

export const PLAYER_HEIGHT = { desktop: 104, mobile: 220 }

type MockTrack = { title: string; podcastName: string }
type MockHandle = { pause: () => void; resume: () => void }
type MockPlayerProps = {
  track: MockTrack
  onPlayStateChange?: (isPlaying: boolean) => void
}

/**
 * Shared jest mock for `./PodcastPlayer`, used by the podcast page test suites
 * (PodcastsListingPage, PodcastDetailPage, PodcastEpisodeDetailPage).
 *
 * Returns a module-shaped object suitable for use as a `jest.mock` factory:
 *
 * ```ts
 * jest.mock("./PodcastPlayer", () =>
 *   jest.requireActual("./PodcastPlayer.test-utils").mockPodcastPlayer(),
 * )
 * ```
 *
 * The mocked player:
 * - exposes an imperative `pause`/`resume` handle via `ref`
 * - signals playback has begun by calling `onPlayStateChange(true)` on mount,
 *   so callers can assert the play/pause toggle after clicking play
 * - renders the current track's title and podcast name for assertions, via the
 *   `player-track-title` and `player-podcast-name` test ids
 */
export const mockPodcastPlayer = () => ({
  __esModule: true as const,
  PLAYER_HEIGHT,
  default: React.forwardRef<MockHandle, MockPlayerProps>(
    function MockPodcastPlayer({ track, onPlayStateChange }, ref) {
      const pause = React.useRef(jest.fn()).current
      const resume = React.useRef(jest.fn()).current
      React.useImperativeHandle(ref, () => ({ pause, resume }))
      React.useEffect(() => {
        onPlayStateChange?.(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <div data-testid="podcast-player">
          <span data-testid="player-track-title">{track.title}</span>
          <span data-testid="player-podcast-name">{track.podcastName}</span>
        </div>
      )
    },
  ),
})
