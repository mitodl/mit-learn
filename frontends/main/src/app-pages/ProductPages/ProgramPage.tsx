"use client"

import React from "react"
import { PlainList, Stack, Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds, parseReqTree, RequirementData } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhoCanTakeSection from "./WhoCanTakeSection"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection, { DEFAULT_HOW_DATA } from "./HowYoullLearnSection"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, pluralize } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ProgramInfoBox from "./InfoBoxProgram"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import MitxOnlineCourseCard from "./MitxOnlineCourseCard"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import { keyBy } from "lodash"
import { getCourseIdsFromReqTree } from "@/common/mitxonline"

type ProgramPageProps = {
  readableId: string
}

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const StyledProgramEnrollmentButton = styled(ProgramEnrollmentButton)(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
  }),
)

const RequirementsListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "24px",
})

const ReqSubsectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(20), // boosted size
})) as typeof Typography

const ReqTitleNote = styled("span")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
}))

type RequirementsSectionProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  isLoading?: boolean
}

const getCompletionText = (parsedReqs: RequirementData[]) => {
  let requiredCount = 0
  let electiveCount = 0
  parsedReqs.forEach((req) => {
    if (req.elective) {
      electiveCount += req.requiredCourseCount
    } else {
      requiredCount += req.requiredCourseCount
    }
  })
  if (requiredCount && electiveCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)} and ${electiveCount} elective ${pluralize("course", electiveCount)}.`
  }
  if (requiredCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)}.`
  }
  if (electiveCount) {
    return `To complete this program, you must take ${electiveCount} ${pluralize("course", electiveCount)}.`
  }
  return ""
}

const getRequirementSectionSubtitle = (reqData: RequirementData) => {
  if (reqData.requiredCourseCount < reqData.courseIds.length) {
    return `Complete ${reqData.requiredCourseCount} out of ${reqData.courseIds.length}`
  }
  return null
}

const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  program,
  courses,
  isLoading,
}) => {
  const coursesById = keyBy(courses ?? [], "id")
  const parsedReqs = parseReqTree(program.req_tree)

  return (
    <Stack
      gap={{ xs: "24px", sm: "32px" }}
      component="section"
      aria-labelledby={HeadingIds.Requirements}
    >
      <div>
        <Typography
          variant="h4"
          component="h2"
          id={HeadingIds.Requirements}
          sx={{ marginBottom: "4px" }}
        >
          Courses
        </Typography>
        <Typography variant="body1" component="p">
          {getCompletionText(parsedReqs)}
        </Typography>
      </div>
      <Stack gap={{ xs: "32px", sm: "56px" }}>
        {parsedReqs.map((req) => {
          const note = getRequirementSectionSubtitle(req)
          return (
            <div key={req.id}>
              <ReqSubsectionTitle component="h3">
                {req.title}
                {note ? ": " : ""}
                {note ? <ReqTitleNote>{note}</ReqTitleNote> : null}
              </ReqSubsectionTitle>
              <RequirementsListing>
                {req.courseIds.map((courseId) => {
                  const course = coursesById[courseId]
                  if (!isLoading && !course) {
                    return null
                  }
                  return (
                    <li key={courseId}>
                      <MitxOnlineCourseCard
                        course={course}
                        href={`/courses/${encodeURIComponent(course?.readable_id)}`}
                        size="small"
                        isLoading={isLoading}
                        list
                      />
                    </li>
                  )
                })}
              </RequirementsListing>
            </div>
          )
        })}
      </Stack>
    </Stack>
  )
}

const ProgramPage: React.FC<ProgramPageProps> = ({ readableId }) => {
  const pages = useQuery(pagesQueries.programPages(readableId))
  const programs = useQuery(
    programsQueries.programsList({ readable_id: readableId }),
  )

  const page = pages.data?.items[0]
  const program = programs.data?.results?.[0]

  const courseIds = program ? getCourseIdsFromReqTree(program.req_tree) : []
  const courses = useQuery({
    ...coursesQueries.coursesList({
      id: courseIds,
      page_size: courseIds.length,
    }),
    enabled: courseIds.length > 0,
  })

  const enabled = useFeatureFlagEnabled(FeatureFlags.MitxOnlineProductPages)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!enabled) {
    return flagsLoaded ? notFound() : null
  }

  const isLoading = pages.isLoading || programs.isLoading

  if (!page || !program) {
    if (!isLoading) {
      return notFound()
    }
    return null
  }

  const imageSrc =
    page.program_details.page.feature_image_src || DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      currentBreadcrumbLabel="Learning Path"
      title={page.title}
      shortDescription={
        <DescriptionHTML
          Component="span"
          html={page.program_details.page.description}
        />
      }
      imageSrc={imageSrc}
      videoUrl={page.video_url}
      enrollmentAction={
        <StyledProgramEnrollmentButton program={program} variant="bordered" />
      }
      infoBox={
        <ProgramInfoBox program={program} courses={courses.data?.results} />
      }
    >
      {page.about ? (
        <AboutSection productNoun="Program" aboutHtml={page.about} />
      ) : null}
      <RequirementsSection
        program={program}
        courses={courses.data?.results}
        // Use skeleton as fallback for loading OR error
        isLoading={!courses.isSuccess}
      />
      {page.what_you_learn ? (
        <WhatYoullLearnSection html={page.what_you_learn} />
      ) : null}
      <HowYoullLearnSection data={DEFAULT_HOW_DATA} />
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
      <WhoCanTakeSection productNoun="Program" />
    </ProductPageTemplate>
  )
}

export default ProgramPage
