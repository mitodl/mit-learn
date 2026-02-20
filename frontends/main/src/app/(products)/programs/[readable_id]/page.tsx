import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import ProgramPage from "@/app-pages/ProductPages/ProgramPage"
import { notFound } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getQueryClient } from "@/app/getQueryClient"

export const generateMetadata = async (
  props: PageProps<"/programs/[readable_id]">,
) => {
  const params = await props.params
  const readableId = decodeURIComponent(params.readable_id)

  return safeGenerateMetadata(async () => {
    const queryClient = getQueryClient()

    const programPages = await queryClient.fetchQuery(
      pagesQueries.programPages(readableId),
    )

    if (programPages.items.length === 0) {
      notFound()
    }
    const [program] = programPages.items

    // Note: feature_image.src is relative to mitxonline root.
    const image = program.feature_image
      ? program.program_details.page.feature_image_src
      : DEFAULT_RESOURCE_IMG

    return standardizeMetadata({
      title: program.title,
      image,
      robots: "noindex, nofollow",
    })
  })
}

const Page: React.FC<PageProps<"/programs/[readable_id]">> = async (props) => {
  const params = await props.params
  const readableId = decodeURIComponent(params.readable_id)

  const queryClient = getQueryClient()

  /**
   * queryClient.fetchQueryOr404 cannot be used here as the Wagtail Pages and
   * MITxOnline Programs API are list endpoints that also 200 with empty results.
   */
  const [programPages, programs] = await Promise.all([
    queryClient.fetchQuery(pagesQueries.programPages(readableId)),
    queryClient.fetchQuery(
      programsQueries.programsList({ readable_id: readableId }),
    ),
  ])

  if (programPages.items.length === 0 || programs.results.length === 0) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProgramPage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
