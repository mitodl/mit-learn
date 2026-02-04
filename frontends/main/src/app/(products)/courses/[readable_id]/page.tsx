import React from "react"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { safeGenerateMetadata, standardizeMetadata } from "@/common/metadata"
import CoursePage from "@/app-pages/ProductPages/CoursePage"
import { notFound } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { getQueryClient } from "@/app/getQueryClient"

export const generateMetadata = async (
  props: PageProps<"/courses/[readable_id]">,
) => {
  const params = await props.params
  const readableId = decodeURIComponent(params.readable_id)

  return safeGenerateMetadata(async () => {
    const queryClient = getQueryClient()

    const coursePages = await queryClient.fetchQuery(
      pagesQueries.coursePages(readableId),
    )

    if (coursePages.items.length === 0) {
      notFound()
    }
    const [course] = coursePages.items

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

  const queryClient = getQueryClient()

  /**
   * queryClient.fetchQueryOr404 cannot be used here as the Wagtail Pages and
   * MITxOnline Courses API are list endpoints that also 200 with empty results.
   */
  const [coursePages, courses] = await Promise.all([
    queryClient.fetchQuery(pagesQueries.coursePages(readableId)),
    queryClient.fetchQuery(
      coursesQueries.coursesList({ readable_id: readableId }),
    ),
  ])

  if (coursePages.items.length === 0 || courses.results.length === 0) {
    notFound()
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CoursePage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
