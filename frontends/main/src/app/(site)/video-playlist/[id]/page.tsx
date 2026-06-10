import { videoPlaylistQueries } from "api/hooks/learningResources"
import { getQueryClient } from "@/app/getQueryClient"
import { notFound, redirect } from "next/navigation"
import { parseResourceId } from "@/common/slugs"
import { videoPlaylistPageView } from "@/common/urls"

/** Bare /video-playlist/{id} is never canonical → 307-redirect to slugged form. */
const Page = async (props: PageProps<"/video-playlist/[id]">) => {
  const { id } = await props.params
  const playlistId = parseResourceId(id)
  if (playlistId === null) {
    notFound()
  }
  const queryClient = getQueryClient()
  const playlist = await queryClient.fetchQueryOr404(
    videoPlaylistQueries.detail(playlistId),
  )
  redirect(videoPlaylistPageView(String(playlistId), playlist.title))
}

export default Page
