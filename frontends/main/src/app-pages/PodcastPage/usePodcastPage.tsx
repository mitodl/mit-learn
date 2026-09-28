"use client"

import React, { useRef } from "react"
import { useMediaQuery } from "ol-components"
import type { Theme } from "ol-components"
import PodcastPlayer from "./PodcastPlayer"
import type { PodcastPlayerHandle } from "./PodcastPlayer"
import { usePodcastPlayer } from "./usePodcastPlayer"

/**
 * Shared setup for the three podcast pages: the `isMobile` media query, the
 * player ref, the `usePodcastPlayer` state, and the fixed player bar itself
 * (rendered once a track is playing). Pages spread the returned player state and
 * render `playerBar` at the end of their tree.
 */
export const usePodcastPage = () => {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"))
  const playerRef = useRef<PodcastPlayerHandle>(null)
  const player = usePodcastPlayer(playerRef, isMobile)

  const playerBar = player.currentTrack ? (
    <PodcastPlayer
      ref={playerRef}
      track={player.currentTrack}
      onClose={player.close}
      onPlayStateChange={player.setIsAudioPlaying}
    />
  ) : null

  return { isMobile, playerBar, ...player }
}
