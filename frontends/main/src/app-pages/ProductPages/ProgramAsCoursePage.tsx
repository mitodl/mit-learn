"use client"

import React from "react"
import { PlainList, Skeleton, Stack, Typography } from "ol-components"
import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds, parseReqTree } from "./util"
import type { RequirementItem } from "./util"
import {
  getIdsFromReqTree,
  isVerifiedEnrollmentMode,
} from "@/common/mitxonline"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection from "./HowYoullLearnSection"
import { DEFAULT_RESOURCE_IMG, pluralize } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ProgramAsCourseInfoBox from "./InfoBoxProgramAsCourse"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { keyBy } from "lodash"

type ProgramAsCoursePageProps = {
  readableId: string
}

const ModuleCardContainer = styled.div(({ theme }) => ({
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  boxShadow: "0px 8px 20px rgba(120, 147, 172, 0.1)",
  padding: "24px 32px",
}))

type ModuleCardProps = {
  title?: string | null
  isLoading?: boolean
}

const ModuleCard: React.FC<ModuleCardProps> = ({ title, isLoading }) => {
  if (isLoading) {
    return (
      <ModuleCardContainer>
        <Skeleton variant="text" width="60%" />
      </ModuleCardContainer>
    )
  }
  if (!title) return null
  return (
    <ModuleCardContainer>
      {/* TODO: Convert to heading as module cards are expanded with more content */}
      <Typography variant="subtitle1">{title}</Typography>
    </ModuleCardContainer>
  )
}

const ModulesListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const ModuleTitleNote = styled("span")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
}))

type ModulesSectionProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  childPrograms?: V2ProgramDetail[]
  isLoading?: boolean
}

const ModulesSection: React.FC<ModulesSectionProps> = ({
  program,
  courses,
  childPrograms,
  isLoading,
}) => {
  const coursesById = keyBy(courses ?? [], "id")
  const programsById = keyBy(childPrograms ?? [], "id")
  const parsedReqs = parseReqTree(program.req_tree)

  if (parsedReqs.length === 0) return null

  const isSingleRoot = parsedReqs.length === 1

  if (!isSingleRoot) {
    console.warn(
      "ModulesSection: unexpected multiple root nodes for course-display program",
      program.readable_id,
    )
  }

  const renderItemList = (items: RequirementItem[]) => (
    <ModulesListing>
      {items.map((item) => {
        if (item.type === "course") {
          const course = coursesById[item.id]
          if (!isLoading && !course) return null
          return (
            <li key={`course-${item.id}`}>
              <ModuleCard title={course?.title} isLoading={isLoading} />
            </li>
          )
        }
        const prog = programsById[item.id]
        if (!isLoading && !prog) return null
        return (
          <li key={`program-${item.id}`}>
            <ModuleCard title={prog?.title} isLoading={isLoading} />
          </li>
        )
      })}
    </ModulesListing>
  )

  if (isSingleRoot) {
    const req = parsedReqs[0]
    const moduleCount = req.items.length
    return (
      <Stack
        gap="16px"
        component="section"
        aria-labelledby={HeadingIds.Modules}
      >
        <div>
          <Typography
            variant="h4"
            component="h2"
            id={HeadingIds.Modules}
            sx={{ marginBottom: "4px" }}
          >
            Modules
          </Typography>
          <Typography variant="body1" component="p">
            {`This course has ${moduleCount} ${pluralize("module", moduleCount)}`}
          </Typography>
        </div>
        {renderItemList(req.items)}
      </Stack>
    )
  }

  // Multiple roots fallback
  // This is unexpected.
  return (
    <Stack
      gap={{ xs: "24px", sm: "32px" }}
      component="section"
      aria-labelledby={HeadingIds.Modules}
    >
      <Typography variant="h4" component="h2" id={HeadingIds.Modules}>
        Modules
      </Typography>
      <Stack gap="24px">
        {parsedReqs.map((req) => {
          const headingId = `modules-subsection-${req.id}`
          const note =
            req.requiredCount < req.items.length
              ? `Complete ${req.requiredCount} out of ${req.items.length}`
              : null
          return (
            <section key={req.id} aria-labelledby={headingId}>
              <Typography
                variant="h5"
                component="h3"
                id={headingId}
                sx={{ marginBottom: "4px" }}
              >
                {req.title}
                {note ? ": " : ""}
                {note ? <ModuleTitleNote>{note}</ModuleTitleNote> : null}
              </Typography>
              {renderItemList(req.items)}
            </section>
          )
        })}
      </Stack>
    </Stack>
  )
}

const StyledProgramEnrollmentButton = styled(ProgramEnrollmentButton)(
  ({ theme }) => ({
    color: theme.custom.colors.darkGray2,
  }),
)

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const ProgramAsCoursePage: React.FC<ProgramAsCoursePageProps> = ({
  readableId,
}) => {
  const pages = useQuery(pagesQueries.programPages(readableId))
  const programs = useQuery(
    programsQueries.programsList({ readable_id: readableId }),
  )

  const page = pages.data?.items[0]
  const program = programs.data?.results?.[0]

  const { courseIds, programIds } = program
    ? getIdsFromReqTree(program.req_tree)
    : { courseIds: [], programIds: [] }

  const courses = useQuery({
    ...coursesQueries.coursesList({
      id: courseIds,
      page_size: courseIds.length,
    }),
    enabled: courseIds.length > 0,
  })

  const childPrograms = useQuery({
    ...programsQueries.programsList({
      id: programIds,
      page_size: programIds.length,
    }),
    enabled: programIds.length > 0,
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

  const dataLoading =
    (courseIds.length > 0 && !courses.isSuccess) ||
    (programIds.length > 0 && !childPrograms.isSuccess)

  return (
    <ProductPageTemplate
      currentBreadcrumbLabel="Course"
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
        <StyledProgramEnrollmentButton
          program={program}
          variant="bordered"
          displayAsCourse
        />
      }
      showStayUpdated={
        program.enrollment_modes.length > 0 &&
        program.enrollment_modes.every((mode) =>
          isVerifiedEnrollmentMode(mode.mode_slug),
        )
      }
      resource={{
        readable_id: program.readable_id,
        resource_type: "program",
      }}
      infoBox={
        <ProgramAsCourseInfoBox
          program={program}
          courses={courses.data?.results}
        />
      }
    >
      {page.about ? (
        <AboutSection productNoun="Course" aboutHtml={page.about} />
      ) : null}
      {page.what_you_learn ? (
        <WhatYoullLearnSection html={page.what_you_learn} />
      ) : null}
      <ModulesSection
        program={program}
        courses={courses.data?.results}
        childPrograms={childPrograms.data?.results}
        isLoading={dataLoading}
      />
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

export default ProgramAsCoursePage
