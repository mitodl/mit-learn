import { useQuery } from "@tanstack/react-query"
import { videoShortsApi } from "../../clients"

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
