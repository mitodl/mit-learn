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

  return safeGenerateMetadata(async () => {
    const queryClient = getQueryClient()

    const data = await queryClient.fetchQuery(
      pagesQueries.programPages(decodeURIComponent(params.readable_id)),
    )

    if (data.items.length === 0) {
      notFound()
    }
    const [program] = data.items

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
  /**
   * TODO: Consider removing react-query from this page
   * fetching via client, and calling notFound() if data missing.
   * This approach blocked by wagtail api requiring auth.
   */
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(pagesQueries.programPages(readableId)),
    queryClient.prefetchQuery(
      programsQueries.programsList({ readable_id: readableId }),
    ),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProgramPage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
