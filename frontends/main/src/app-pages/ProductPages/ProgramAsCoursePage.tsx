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
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhoCanTakeSection from "./WhoCanTakeSection"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection, { DEFAULT_HOW_DATA } from "./HowYoullLearnSection"
import { DEFAULT_RESOURCE_IMG, pluralize } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ProgramAsCourseInfoBox from "./InfoBoxProgramAsCourse"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"

type ProgramAsCoursePageProps = {
  readableId: string
}

const keyBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T> =>
  Object.fromEntries(array.map((item) => [String(item[key]), item]))

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
      <Typography variant="subtitle1">{title}</Typography>
    </ModuleCardContainer>
  )
}

const ModulesListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "24px",
})

const ModuleSubsectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(20),
})) as typeof Typography

const ModuleTitleNote = styled("span")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
}))

type ModulesSectionProps = {
  program: V2ProgramDetail
}

const ModulesSection: React.FC<ModulesSectionProps> = ({ program }) => {
  const courses = useQuery(coursesQueries.coursesForProgram(program))
  const coursesById = keyBy(courses.data?.results ?? [], "id")
  const parsedReqs = parseReqTree(program.req_tree)

  if (parsedReqs.length === 0) return null

  const isSingleRoot = parsedReqs.length === 1

  if (!isSingleRoot) {
    console.warn(
      "ModulesSection: unexpected multiple root nodes for course-display program",
      program.readable_id,
    )
  }

  const renderCourseList = (courseIds: number[]) => (
    <ModulesListing>
      {courseIds.map((courseId) => {
        const course = coursesById[courseId]
        const isCourseLoading = courses.isLoading || !courses.data
        if (!isCourseLoading && !course) return null
        return (
          <li key={courseId}>
            <ModuleCard title={course?.title} isLoading={isCourseLoading} />
          </li>
        )
      })}
    </ModulesListing>
  )

  if (isSingleRoot) {
    const req = parsedReqs[0]
    const moduleCount = req.courseIds.length
    return (
      <Stack
        gap={{ xs: "24px", sm: "32px" }}
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
        {renderCourseList(req.courseIds)}
      </Stack>
    )
  }

  // Multiple roots fallback
  return (
    <Stack
      gap={{ xs: "24px", sm: "32px" }}
      component="section"
      aria-labelledby={HeadingIds.Modules}
    >
      <Typography variant="h4" component="h2" id={HeadingIds.Modules}>
        Modules
      </Typography>
      <Stack gap={{ xs: "32px", sm: "56px" }}>
        {parsedReqs.map((req) => {
          const note =
            req.requiredCourseCount < req.courseIds.length
              ? `Complete ${req.requiredCourseCount} out of ${req.courseIds.length}`
              : null
          return (
            <div key={req.id}>
              <ModuleSubsectionTitle component="h3">
                {req.title}
                {note ? ": " : ""}
                {note ? <ModuleTitleNote>{note}</ModuleTitleNote> : null}
              </ModuleSubsectionTitle>
              {renderCourseList(req.courseIds)}
            </div>
          )
        })}
      </Stack>
    </Stack>
  )
}

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

  const imageSrc = page.feature_image
    ? page.program_details.page.feature_image_src
    : DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      tags={["MITx"]}
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
      infoBox={<ProgramAsCourseInfoBox program={program} />}
    >
      {page.about ? (
        <AboutSection productNoun="Course" aboutHtml={page.about} />
      ) : null}
      <ModulesSection program={program} />
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
      <WhoCanTakeSection productNoun="Course" />
    </ProductPageTemplate>
  )
}

export default ProgramAsCoursePage
