import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import {
  safeGenerateMetadata,
  standardizeMetadata,
  MetadataNotFound,
} from "@/common/metadata"
import ProgramAsCoursePage from "@/app-pages/ProductPages/ProgramAsCoursePage"
import { notFound, redirect } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getQueryClient } from "@/app/getQueryClient"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { programPageView } from "@/common/urls"

export const generateMetadata = async (
  props: PageProps<"/courses/p/[readable_id]">,
) => {
  const params = await props.params
  const readableId = decodeURIComponent(params.readable_id)

  return safeGenerateMetadata(async () => {
    const queryClient = getQueryClient()

    const { results: programs } = await queryClient.fetchQuery(
      programsQueries.programsList({ readable_id: readableId, live: true }),
    )

    if (programs.length === 0) {
      throw new MetadataNotFound()
    }
    const [program] = programs

    const image = program.page?.feature_image_src || DEFAULT_RESOURCE_IMG

    return standardizeMetadata({
      title: program.title,
      image,
    })
  })
}

const Page: React.FC<PageProps<"/courses/p/[readable_id]">> = async (props) => {
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
      programsQueries.programsList({ readable_id: readableId, live: true }),
    ),
  ])

  if (programPages.items.length === 0 || programs.results.length === 0) {
    notFound()
  }

  const program = programs.results[0]

  // Redirect to program page if display_mode is not "course"
  if (program.display_mode !== DisplayModeEnum.Course) {
    redirect(
      programPageView({
        readable_id: readableId,
        display_mode: program.display_mode,
      }),
    )
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProgramAsCoursePage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
