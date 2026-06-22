"use client"

import React, { useEffect } from "react"
import { Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled, Button } from "@mitodl/smoot-design"
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
import CourseInfoBox from "./InfoBoxCourse"
import CourseOutlineSection from "./CourseOutlineSection"
import {
  trackViewCoursePage,
  trackCourseProgramView,
} from "@/common/analytics/gtm"
import { EnrollButton } from "./CourseEnrollArea"
import { useCourseEnrollment } from "./useCourseEnrollment"
import { getSelectedRun } from "./courseRun"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import EnrolledLink from "./EnrolledLink"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"

type CoursePageProps = {
  readableId: string
}

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

/**
 * The page-header enroll button uses the `bordered` variant but with darkGray2
 * text (matching production), not the variant's default silverGrayDark. Disabled
 * buttons keep the variant default. `display: contents` adds no layout box.
 */
const HeaderButtonSlot = styled.div(({ theme }) => ({
  display: "contents",
  "& button:not(:disabled), & a": {
    color: theme.custom.colors.darkGray2,
  },
}))

const CourseHeaderEnrollButton: React.FC<{
  course: CourseWithCourseRunsSerializerV2
}> = ({ course }) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)

  const { state, isStatusLoading, isPending } = useCourseEnrollment(
    course,
    getSelectedRun(course),
    { onRequireSignup: (el) => setAnchor(el) },
  )

  if (state.status === "enrolled") {
    return (
      <HeaderButtonSlot>
        <EnrolledLink variant="bordered" href={state.href} />
      </HeaderButtonSlot>
    )
  }

  if (state.status === "options") {
    return (
      <HeaderButtonSlot>
        <EnrollButton
          action={state.options[0]}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          variant="bordered"
          announceStatus={false}
        />
        <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
      </HeaderButtonSlot>
    )
  }

  // status === "none"
  return (
    <HeaderButtonSlot>
      <Button variant="bordered" size="large" disabled>
        Enroll
      </Button>
    </HeaderButtonSlot>
  )
}

const CoursePage: React.FC<CoursePageProps> = ({ readableId }) => {
  const pages = useQuery(pagesQueries.coursePages(readableId))
  const courses = useQuery(
    coursesQueries.coursesList({ readable_id: readableId, live: true }),
  )
  const page = pages.data?.items[0]
  const course = courses.data?.results?.[0]
  const effectiveOutlineCoursewareId = course
    ? getOutlineCoursewareId(course)
    : undefined
  const showCourseOutline = useFeatureFlagEnabled(
    FeatureFlags.CourseOutlineSection,
  )
  const outline = useQuery({
    ...coursesQueries.courseOutline(effectiveOutlineCoursewareId ?? ""),
    enabled: Boolean(showCourseOutline && effectiveOutlineCoursewareId),
  })
  useEffect(() => {
    if (!course) return
    trackViewCoursePage(course.title)
    trackCourseProgramView({ name: course.title, id: course.readable_id })
  }, [course])

  const doneLoading = pages.isSuccess && courses.isSuccess

  if (!page || !course) {
    if (doneLoading) {
      return notFound()
    } else {
      return null
    }
  }

  const imageSrc =
    page.course_details.page?.feature_image_src || DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      currentBreadcrumbLabel="Course"
      title={page.title}
      shortDescription={page.course_details.page?.description}
      imageSrc={imageSrc}
      videoUrl={page.video_url}
      infoBox={<CourseInfoBox course={course} />}
      enrollmentAction={<CourseHeaderEnrollButton course={course} />}
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
      {showCourseOutline ? (
        <CourseOutlineSection modules={outline.data?.modules ?? []} />
      ) : null}
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
