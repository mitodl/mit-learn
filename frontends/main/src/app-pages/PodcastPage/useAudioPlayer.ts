import { useRef, useState, useEffect, useCallback } from "react"

/** Playback speeds cycled through by the speed button; index 1 (1x) is default. */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

/**
 * Format a number of seconds as a clock time. Includes an hours component only
 * when the duration reaches an hour (`h:mm:ss`, else `mm:ss`), with zero-padded
 * minutes/seconds.
 *
 * NB: `ol-utilities`' `formatDurationClockTime` is intentionally not reused here
 * — it does not zero-pad the leading minutes (`2:05` vs `02:05`), which would
 * change the player UI and break existing tests.
 */
export const formatClockTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * User-facing messages for the ways playback can fail. Kept deliberately short:
 * the fixed player bar renders them in place of the progress bar, where there
 * is room for about two lines.
 */
export const PLAYBACK_ERROR_MESSAGES = {
  /** The episode has no audio URL at all — nothing to fetch. */
  noSource: "Audio isn't available for this episode.",
  /** The device has no connection at all. */
  offline: "You appear to be offline. Check your connection and try again.",
  /** Transport failed part-way through (connection dropped, timeout). */
  network:
    "We couldn't load this episode. Check your connection and try again.",
  /** The bytes arrived but aren't decodable audio. */
  decode: "This episode's audio file is damaged and can't be played.",
  /**
   * The host refused or the response wasn't playable media. This is what a
   * geo-block (HTTP 451), a 403/404, or a CORS rejection surfaces as, so the
   * message names region restriction as the likely cause.
   */
  unavailable:
    "This episode can't be played. It may be unavailable in your region.",
  /** Playback failed for a reason the browser didn't classify. */
  generic: "Something went wrong playing this episode.",
} as const

// MediaError codes. Spelled out as literals rather than read off the global
// `MediaError` so this stays valid in environments that don't define it.
const MEDIA_ERR_ABORTED = 1
const MEDIA_ERR_NETWORK = 2
const MEDIA_ERR_DECODE = 3
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

/**
 * Whether the device has no connection. Only `false` from `navigator.onLine` is
 * trustworthy — `true` means an interface is up, not that anything is
 * reachable — which is exactly the direction we need.
 */
const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false

/**
 * Translate the `<audio>` element's error into a message, or `null` when the
 * failure isn't worth surfacing. Aborts are ignored: they are what a track
 * change or a fresh `load()` looks like, not a problem the user caused or can
 * act on.
 *
 * Connectivity is checked before the error code. A request that never reaches
 * the network is reported as `MEDIA_ERR_SRC_NOT_SUPPORTED` — the same code a
 * geo-block produces — because the browser only knows it received nothing
 * playable, not why. Blaming the provider when the device is plainly offline
 * sends the user chasing the wrong problem.
 */
const messageForMediaError = (
  mediaError: MediaError | null | undefined,
): string | null => {
  if (mediaError?.code === MEDIA_ERR_ABORTED) return null
  if (isOffline()) return PLAYBACK_ERROR_MESSAGES.offline
  switch (mediaError?.code) {
    case MEDIA_ERR_NETWORK:
      return PLAYBACK_ERROR_MESSAGES.network
    case MEDIA_ERR_DECODE:
      return PLAYBACK_ERROR_MESSAGES.decode
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return PLAYBACK_ERROR_MESSAGES.unavailable
    default:
      return PLAYBACK_ERROR_MESSAGES.generic
  }
}

type UseAudioPlayerOptions = {
  /** Start playing as soon as a track loads (the fixed player bar). */
  autoPlay?: boolean
  /** Notified whenever the playing/paused state changes. */
  onPlayStateChange?: (isPlaying: boolean) => void
}

/**
 * Shared audio-playback engine for the podcast players. Owns the `<audio>`
 * element wiring, play/pause/seek/skip/speed state, and buffering/pending
 * handling. Consumers render their own layout and spread `audioProps` onto an
 * `<audio ref={audioRef} />`.
 */
export const useAudioPlayer = (
  audioUrl: string,
  { autoPlay = false, onPlayStateChange }: UseAudioPlayerOptions = {},
) => {
  const hasAudioSource = Boolean(audioUrl.trim())
  const audioRef = useRef<HTMLAudioElement>(null)
  const isPlayPendingRef = useRef(false)
  const playAttemptIdRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(autoPlay)
  const [isPlayPending, setIsPlayPending] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1) // default 1x
  const speedIndexRef = useRef(1)
  const [loadError, setLoadError] = useState<string | null>(null)

  const startPlayback = useCallback(async () => {
    if (!hasAudioSource || isPlayPendingRef.current) return

    const audio = audioRef.current
    if (!audio) return

    // Guard against overlapping play attempts (e.g. rapid clicks / track change).
    const attemptId = ++playAttemptIdRef.current
    isPlayPendingRef.current = true
    setIsPlayPending(true)

    try {
      await audio.play()
      if (playAttemptIdRef.current === attemptId) {
        setIsPlaying(true)
      }
    } catch (err) {
      if (playAttemptIdRef.current === attemptId) {
        setIsPlaying(false)
        const name = (err as DOMException | undefined)?.name
        // NotAllowedError is the browser's autoplay policy, not a fault: the
        // user only needs to press play. AbortError means a newer load()
        // superseded this attempt. Neither is worth a message.
        if (name !== "NotAllowedError" && name !== "AbortError") {
          // Keep any message the `error` event already produced — it names the
          // specific cause, where this fallback can only guess.
          const fallback = isOffline()
            ? PLAYBACK_ERROR_MESSAGES.offline
            : PLAYBACK_ERROR_MESSAGES.generic
          setLoadError((current) => current ?? fallback)
        }
      }
    } finally {
      if (playAttemptIdRef.current === attemptId) {
        isPlayPendingRef.current = false
        setIsPlayPending(false)
      }
    }
  }, [hasAudioSource])

  // Reset (and, when autoPlay, start) whenever the track changes.
  useEffect(() => {
    // Invalidate any in-flight play attempt from a previous track.
    playAttemptIdRef.current += 1
    isPlayPendingRef.current = false
    setIsPlayPending(false)

    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setIsBuffering(autoPlay && hasAudioSource)
    // A new track gets a clean slate: the previous track's failure says nothing
    // about this one.
    setLoadError(null)

    if (!hasAudioSource) return

    const audio = audioRef.current
    if (!audio) return
    audio.load()
    audio.playbackRate = SPEED_OPTIONS[speedIndexRef.current]
    if (autoPlay) void startPlayback()
  }, [audioUrl, hasAudioSource, autoPlay, startPlayback])

  useEffect(() => {
    onPlayStateChange?.(isPlaying)
  }, [isPlaying, onPlayStateChange])

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  const resume = useCallback(() => {
    void startPlayback()
  }, [startPlayback])

  /**
   * Re-fetch the current track and try again after a failure. A plain `play()`
   * would not do: once the element has errored it stays in that state until the
   * resource is reloaded.
   */
  const retry = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !hasAudioSource) return
    setLoadError(null)
    setIsBuffering(true)
    audio.load()
    void startPlayback()
  }, [hasAudioSource, startPlayback])

  const togglePlay = useCallback(() => {
    if (!hasAudioSource) return
    const audio = audioRef.current
    if (!audio) return
    // After a failure the play button acts as a second retry affordance, so
    // pressing it does the same reload the "Try again" button does.
    if (loadError) {
      retry()
      return
    }
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      void startPlayback()
    }
  }, [hasAudioSource, isPlaying, startPlayback, loadError, retry])

  const skip = useCallback(
    (seconds: number) => {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = Math.max(
        0,
        Math.min(audio.currentTime + seconds, duration),
      )
    },
    [duration],
  )

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((current) => {
      const nextIndex = (current + 1) % SPEED_OPTIONS.length
      speedIndexRef.current = nextIndex
      if (audioRef.current) {
        audioRef.current.playbackRate = SPEED_OPTIONS[nextIndex]
      }
      return nextIndex
    })
  }, [])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = time
  }, [])

  const percent = duration ? (currentTime / duration) * 100 : 0

  // A missing URL is reported the same way a failed fetch is — from the
  // listener's point of view the episode simply won't play — but it is derived
  // rather than stored, since no load is ever attempted.
  const error = hasAudioSource ? loadError : PLAYBACK_ERROR_MESSAGES.noSource

  /** Props to spread onto `<audio ref={audioRef} {...audioProps} />`. */
  const audioProps = {
    src: hasAudioSource ? audioUrl : undefined,
    onWaiting: () => setIsBuffering(true),
    onCanPlay: () => setIsBuffering(false),
    onError: () => {
      setIsBuffering(false)
      setIsPlaying(false)
      const message = messageForMediaError(audioRef.current?.error)
      if (message) setLoadError(message)
    },
    onTimeUpdate: () => setCurrentTime(audioRef.current?.currentTime ?? 0),
    onLoadedMetadata: () => setDuration(audioRef.current?.duration ?? 0),
    onEnded: () => setIsPlaying(false),
  }

  return {
    audioRef,
    audioProps,
    hasAudioSource,
    isPlaying,
    isBuffering,
    isPlayPending,
    currentTime,
    duration,
    percent,
    speed: SPEED_OPTIONS[speedIndex],
    /** A user-facing failure message, or `null` while playback is healthy. */
    error,
    togglePlay,
    skip,
    cycleSpeed,
    seek,
    pause,
    resume,
    retry,
  }
}
