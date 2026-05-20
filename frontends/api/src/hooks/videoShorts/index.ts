import { useQuery } from "@tanstack/react-query"
import { videoShortsApi, learningResourcesSearchApi } from "../../clients"
import type { VideoResource } from "../../generated/v1"

export const useVideoShortsList = () => {
  return useQuery({
    queryKey: ["video_shorts", "list"],
    queryFn: async () => {
      const { data } = await videoShortsApi.videoShortsList({
        limit: 50,
      })
      return data.results
    },
  })
}

export const useVideoShortsLearningResources = () => {
  return useQuery({
    queryKey: ["video_shorts", "learning_resources"],
    queryFn: async () => {
      const { data } =
        await learningResourcesSearchApi.learningResourcesSearchRetrieve({
          resource_category: ["Video Short"],
          limit: 50,
        })
      return data.results.filter(
        (r): r is VideoResource => r.resource_type === "video",
      )
    },
  })
}
