import { useQuery } from "@tanstack/react-query"
import axios from "axios"

// API key needed to access public YouTube API (quota limited) - not sensitive
const YOUTUBE_API_KEY = "AIzaSyBzQsnRUW5vkV8vYt9twPecl-nuM8ykLCY" // pragma: allowlist secret

// https://www.youtube.com/@MITOpenLearning
const YOUTUBE_CHANNEL_ID = "UCN0QBfKk0ZSytyX_16M11fA"

// https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCN0QBfKk0ZSytyX_16M11fA&type=short&order=date&maxResults=50&key=AIzaSyBzQsnRUW5vkV8vYt9twPecl-nuM8ykLCY
export const useVideoShortsList = () => {
  return useQuery({
    queryKey: ["youtube_shorts", "list"],
    queryFn: async () => {
      const { data } = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&type=short&order=date&maxResults=50&key=${YOUTUBE_API_KEY}`,
      )

      console.log(">>>>>>.:data", data)
      return data.items
    },
  })
}
