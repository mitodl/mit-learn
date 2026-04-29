import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { learningResourceQueries } from "api/hooks/learningResources"
import type { VideoResource } from "api/v1"
import { VideoResourceResourceTypeEnum } from "api/v1"

export type SeriesNavigation = {
  videoItems: VideoResource[]
  currentIndex: number
  prevVideo: VideoResource | null
  nextVideo: VideoResource | null
  videoPosition: number | null
  itemsLoading: boolean
  getVideoHref: (v: VideoResource) => string
}

export function useSeriesNavigation(
  videoId: number,
  playlistId: number | null,
): SeriesNavigation {
  const { data: playlistItems, isLoading: itemsLoading } = useQuery({
    ...learningResourceQueries.items(playlistId ?? 0, {
      learning_resource_id: playlistId ?? 0,
    }),
    enabled: !!playlistId,
  })

  const videoItems = useMemo(
    () =>
      (playlistItems ?? []).filter(
        (item): item is VideoResource =>
          item.resource_type === VideoResourceResourceTypeEnum.Video,
      ),
    [playlistItems],
  )

  const currentIndex = videoItems.findIndex((item) => item.id === videoId)
  const prevVideo = currentIndex > 0 ? videoItems[currentIndex - 1] : null
  const nextVideo =
    currentIndex >= 0 && currentIndex < videoItems.length - 1
      ? videoItems[currentIndex + 1]
      : null
  const videoPosition = currentIndex >= 0 ? currentIndex + 1 : null

  const getVideoHref = (v: VideoResource) =>
    `/video-playlist/detail/${v.id}?playlist=${playlistId}`

  return {
    videoItems,
    currentIndex,
    prevVideo,
    nextVideo,
    videoPosition,
    itemsLoading,
    getVideoHref,
  }
}
