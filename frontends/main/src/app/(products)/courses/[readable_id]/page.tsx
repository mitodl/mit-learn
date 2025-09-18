import React from "react"
import { HydrationBoundary } from "@tanstack/react-query"
import { standardizeMetadata } from "@/common/metadata"
import { prefetch } from "api/ssr/prefetch"
import CoursePage from "@/app-pages/CoursePage/CoursePage"
import { pagesApi } from "api/mitxonline"
import * as Sentry from "@sentry/nextjs"
import { notFound } from "next/navigation"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { coursesQueries } from "api/mitxonline-hooks/courses"

export const generateMetadata = async (
  props: PageProps<"/courses/[readable_id]">,
) => {
  const params = await props.params

  try {
    const resp = await pagesApi.pagesfieldstypecmsCoursePageRetrieve({
      readable_id: decodeURIComponent(params.readable_id),
    })
    if (resp.data.items.length === 0) {
      notFound()
    }
    const [course] = resp.data.items
    return standardizeMetadata({
      title: course.title,
      image: course.course_details.page.feature_image_src,
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
  const { dehydratedState } = await prefetch([
    pagesQueries.pagesDetail(readableId),
    coursesQueries.coursesList({ readable_id: readableId }),
  ])
  return (
    <HydrationBoundary state={dehydratedState}>
      <CoursePage readableId={readableId} />
    </HydrationBoundary>
  )
}

export default Page
