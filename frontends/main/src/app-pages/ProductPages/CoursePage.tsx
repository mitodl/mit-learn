"use client"

import React from "react"
import { Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { getOutlineCoursewareId, HeadingIds } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection from "./HowYoullLearnSection"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { isVerifiedEnrollmentMode } from "@/common/mitxonline"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import CourseInfoBox from "./InfoBoxCourse"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import CourseOutlineSection from "./CourseOutlineSection"

type CoursePageProps = {
  readableId: string
}

const StyledCourseEnrollmentButton = styled(CourseEnrollmentButton)(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
  }),
)

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pages = useQuery(pagesQueries.coursePages(readableId))
  const courses = useQuery(
    coursesQueries.coursesList({ readable_id: readableId }),
  )
  const page = pages.data?.items[0]
  const course = courses.data?.results?.[0]
  const effectiveOutlineCoursewareId = course
    ? getOutlineCoursewareId(course)
    : undefined
  const outline = useQuery({
    ...coursesQueries.courseOutline(effectiveOutlineCoursewareId ?? ""),
    enabled: Boolean(effectiveOutlineCoursewareId),
  })
  const enabled = useFeatureFlagEnabled(FeatureFlags.MitxOnlineProductPages)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!enabled) {
    return flagsLoaded ? notFound() : null
  }

  const doneLoading = pages.isSuccess && courses.isSuccess

  if (!page || !course) {
    if (doneLoading) {
      return notFound()
    } else {
      return null
    }
  }

  const imageSrc =
    page.course_details.page.feature_image_src || DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      currentBreadcrumbLabel="Course"
      title={page.title}
      shortDescription={page.course_details.page.description}
      imageSrc={imageSrc}
      videoUrl={page.video_url}
      infoBox={<CourseInfoBox course={course} />}
      enrollmentAction={
        <StyledCourseEnrollmentButton course={course} variant="bordered" />
      }
      showStayUpdated={
        course.courseruns.length > 0 &&
        course.courseruns.every(
          (run) =>
            run.enrollment_modes.length > 0 &&
            run.enrollment_modes.every((mode) =>
              isVerifiedEnrollmentMode(mode.mode_slug),
            ),
        )
      }
      resource={{
        readable_id: course.readable_id,
        resource_type: "course",
      }}
    >
      {page.about ? (
        <AboutSection productNoun="Course" aboutHtml={page.about} />
      ) : null}
      {page.what_you_learn ? (
        <WhatYoullLearnSection html={page.what_you_learn} />
      ) : null}
      <CourseOutlineSection modules={outline.data?.modules ?? []} />
      <HowYoullLearnSection page={page} />
      {page.prerequisites ? (
        <PrerequisitesSection aria-labelledby={HeadingIds.Prereqs}>
          <Typography variant="h4" component="h2" id={HeadingIds.Prereqs}>
            Prerequisites
          </Typography>
          <RawHTML html={page.prerequisites} />
        </PrerequisitesSection>
      ) : null}
      {page.faculty.length ? (
        <InstructorsSection instructors={page.faculty} />
      ) : null}
    </ProductPageTemplate>
  )
}

export default CoursePage
