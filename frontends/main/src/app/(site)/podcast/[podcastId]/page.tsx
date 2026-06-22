import { getQueryClient } from "@/app/getQueryClient"
import { ResourceTypeEnum } from "api"
import { learningResourceQueries } from "api/hooks/learningResources"
import { notFound, redirect } from "next/navigation"
import { parseResourceId } from "@/common/slugs"
import { carrySearchParams, podcastPageView } from "@/common/urls"

/** Bare /podcast/{id} is never canonical → 307-redirect to the slugged form. */
const Page = async (props: PageProps<"/podcast/[podcastId]">) => {
  const { podcastId } = await props.params
  const id = parseResourceId(podcastId)
  if (id === null) {
    notFound()
  }
  const queryClient = getQueryClient()
  const resource = await queryClient.fetchQueryOr404(
    learningResourceQueries.detail(id),
  )
  if (resource.resource_type !== ResourceTypeEnum.Podcast) {
    notFound()
  }
  redirect(
    carrySearchParams(
      podcastPageView(String(id), resource.title),
      await props.searchParams,
    ),
  )
}
export default Page
