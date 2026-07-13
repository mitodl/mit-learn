import { useEffect, useState } from "react"
import type { RefObject } from "react"
import type { LearningResource } from "api/v1"
import { PLAYER_HEIGHT } from "./PodcastPlayer"
import type { PodcastTrack, PodcastPlayerHandle } from "./PodcastPlayer"
import { getEpisodeAudioUrl } from "./PodcastsListingPage/helpers"

/**
 * Shared play/pause/resume state and behavior for the podcast player,
 * used by PodcastsListingPage, PodcastDetailPage, and PodcastEpisodeDetailPage.
 *
 * NOTE: `podcastName` is passed in by the caller at `toggle()` time rather
 * than derived here, since each page currently resolves the "parent podcast
 * name" for a track differently (e.g. `episode.offered_by?.name` vs. a
 * separately-fetched podcast's `title`). Reconciling that inconsistency is
 * left for a follow-up.
 */
export const usePodcastPlayer = (
  playerRef: RefObject<PodcastPlayerHandle | null>,
  isMobile: boolean,
) => {
  const [playingEpisode, setPlayingEpisode] = useState<LearningResource | null>(
    null,
  )
  const [podcastName, setPodcastName] = useState("Podcast")
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  /** Starts a new episode, or resumes/pauses the one already loaded. */
  const toggle = (
    episode: LearningResource,
    podcastNameForEpisode?: string,
  ) => {
    if (!getEpisodeAudioUrl(episode)) return
    if (playingEpisode?.id === episode.id) {
      if (isAudioPlaying) {
        playerRef.current?.pause()
      } else {
        playerRef.current?.resume()
      }
    } else {
      setPlayingEpisode(episode)
      setPodcastName(podcastNameForEpisode || "Podcast")
    }
  }

  const pause = () => playerRef.current?.pause()

  const close = () => setPlayingEpisode(null)

  const currentTrack: PodcastTrack | null = playingEpisode
    ? (() => {
        const audioUrl = getEpisodeAudioUrl(playingEpisode)
        if (!audioUrl) return null
        return {
          audioUrl,
          title: playingEpisode.title || "Untitled Episode",
          podcastName,
        }
      })()
    : null

  // When the player is active, shrink the page layout so the footer is
  // visible above the fixed player bar.
  useEffect(() => {
    const root = document.documentElement
    if (currentTrack) {
      const height = isMobile ? PLAYER_HEIGHT.mobile : PLAYER_HEIGHT.desktop
      root.style.setProperty("--mit-player-height", `${height}px`)
    } else {
      root.style.removeProperty("--mit-player-height")
    }
    return () => {
      root.style.removeProperty("--mit-player-height")
    }
  }, [currentTrack, isMobile])

  return {
    playingEpisode,
    isAudioPlaying,
    setIsAudioPlaying,
    currentTrack,
    toggle,
    pause,
    close,
  }
}
