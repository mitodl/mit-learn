import React from "react"
import { HydrationBoundary } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import { prefetch } from "api/ssr/prefetch"
import CoursePage from "@/app-pages/ProductPages/CoursePage"
import { notFound } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getServerQueryClient } from "api/ssr/serverQueryClient"

export const generateMetadata = async (
  props: PageProps<"/courses/[readable_id]">,
) => {
  const params = await props.params

  return safeGenerateMetadata(async () => {
    const queryClient = getServerQueryClient()

    const data = await queryClient.fetchQuery(
      pagesQueries.coursePages(decodeURIComponent(params.readable_id)),
    )

    if (data.items.length === 0) {
      notFound()
    }
    const [course] = data.items
    const image = course.feature_image
      ? course.course_details.page.feature_image_src
      : DEFAULT_RESOURCE_IMG
    return standardizeMetadata({
      title: course.title,
      image,
      robots: "noindex, nofollow",
    })
  })
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
    pagesQueries.coursePages(readableId),
    coursesQueries.coursesList({ readable_id: readableId }),
  ])
  return (
    <HydrationBoundary state={dehydratedState}>
      <CoursePage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
