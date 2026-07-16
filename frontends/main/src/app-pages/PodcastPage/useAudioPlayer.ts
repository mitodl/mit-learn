import { useRef, useState, useEffect, useCallback } from "react"

/** Playback speeds cycled through by the speed button; index 1 (1x) is default. */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2]

/**
 * Format a number of seconds as a clock time. Includes an hours component only
 * when the duration reaches an hour (`mm:ss`, else `h:mm:ss`), with zero-padded
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
    } catch {
      if (playAttemptIdRef.current === attemptId) {
        setIsPlaying(false)
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

  const togglePlay = useCallback(() => {
    if (!hasAudioSource) return
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      void startPlayback()
    }
  }, [hasAudioSource, isPlaying, startPlayback])

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

  /** Props to spread onto `<audio ref={audioRef} {...audioProps} />`. */
  const audioProps = {
    src: hasAudioSource ? audioUrl : undefined,
    onWaiting: () => setIsBuffering(true),
    onCanPlay: () => setIsBuffering(false),
    onError: () => {
      setIsBuffering(false)
      setIsPlaying(false)
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
    togglePlay,
    skip,
    cycleSpeed,
    seek,
    pause,
    resume,
  }
}
