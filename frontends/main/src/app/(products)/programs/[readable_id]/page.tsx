import React from "react"
import { HydrationBoundary } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import { prefetch } from "api/ssr/prefetch"
import ProgramPage from "@/app-pages/ProductPages/ProgramPage"
import { pagesApi } from "api/mitxonline"
import * as Sentry from "@sentry/nextjs"
import { notFound } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { programsQueries } from "api/mitxonline-hooks/programs"

export const generateMetadata = async (
  props: PageProps<"/programs/[readable_id]">,
) => {
  const params = await props.params

  try {
    const resp = await pagesApi.pagesfieldstypecmsProgramPageRetrieve({
      readable_id: decodeURIComponent(params.readable_id),
    })

    if (resp.data.items.length === 0) {
      notFound()
    }
    const [program] = resp.data.items
    return standardizeMetadata({
      title: program.title,
      image: program.program_details.page.feature_image_src,
      robots: "noindex, nofollow",
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error(
      "Error fetching course page metadata for",
      params.readable_id,
      error,
    )
  }
}

const Page: React.FC<PageProps<"/courses/[readable_id]">> = async (props) => {
  const params = await props.params
  const readableId = decodeURIComponent(params.readable_id)
  /**
   * TODO: Consider removing react-query from this page
   * fetching via client, and calling notFound() if data missing.
   * This approach blocked by wagtail api requiring auth.
   */
  const { dehydratedState } = await prefetch([
    pagesQueries.programsDetail(readableId),
    programsQueries.programsList({ readable_id: readableId }),
  ])
  return (
    <HydrationBoundary state={dehydratedState}>
      <ProgramPage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
