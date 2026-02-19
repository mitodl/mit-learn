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
import { HeadingIds, parseReqTree } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import ProductNavbar, { HeadingData } from "./ProductNavbar"
import WhoCanTakeSection from "./WhoCanTakeSection"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection, { DEFAULT_HOW_DATA } from "./HowYoullLearnSection"
import { ProgramPageItem, V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { ProgramSummary } from "./ProductSummary"
import { DEFAULT_RESOURCE_IMG, pluralize } from "ol-utilities"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import MitxOnlineCourseCard from "./MitxOnlineCourseCard"

type ProgramPageProps = {
  readableId: string
}

const PrerequisitesSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const getNavLinks = (page: ProgramPageItem): HeadingData[] => {
  const all = [
    {
      id: HeadingIds.About,
      label: "About",
      variant: "primary",
      content: page.about,
    },
    {
      id: HeadingIds.What,
      label: "What you'll learn",
      variant: "secondary",
      content: page.what_you_learn,
    },
    {
      id: HeadingIds.How,
      label: "How you'll learn",
      variant: "secondary",
      content: true,
    },
    {
      id: HeadingIds.Prereqs,
      label: "Prerequisites",
      variant: "secondary",
      content: page.prerequisites,
    },
    {
      id: HeadingIds.Instructors,
      label: "Instructors",
      variant: "secondary",
      content: page.faculty.length,
    },
  ] as const
  return all.filter((item) => item.content)
}

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const RequirementsListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "24px",
})

const keyBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T> => {
  return Object.fromEntries(array.map((item) => [String(item[key]), item]))
}

type RequirementSubsectionInfo = {
  title: string
  note?: string
  titleId: string
  courseIds: number[]
}

const ReqSubsectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(20), // boosted size
})) as typeof Typography

const ReqTitleNote = styled("span")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
}))

type RequirementsSectionProps = {
  program: V2Program
}

const getCompletionText = ({
  requiredCount,
  electiveCount,
}: {
  requiredCount?: number
  electiveCount?: number
}) => {
  if (requiredCount && electiveCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)} and ${electiveCount} elective ${pluralize("course", electiveCount)}.`
  }
  if (requiredCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)}.`
  }
  if (electiveCount) {
    return `To complete this program, you must take ${electiveCount} ${pluralize("course", electiveCount)}.`
  }
  return "" // Program has no requirements at all. Something went wrong.
}

const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  program,
}) => {
  const courses = useQuery(coursesQueries.coursesForProgram(program))
  const coursesById = keyBy(courses.data?.results ?? [], "id")
  /**
   * req_tree allows for multiple elective sections, however
   * the V2Program.requirements schema, from which we get course readable IDs,
   * only supports at most one elective section and one required section.
   */
  const parsedReqs = parseReqTree(program.req_tree)
  const required = parsedReqs.find((req) => !req.elective)
  const electives = parsedReqs.find((req) => req.elective)

  const subsections: RequirementSubsectionInfo[] = [
    required && {
      title: required.title,
      titleId: HeadingIds.RequirementsRequired,
      courseIds: required.courseIds,
    },
    electives && {
      title: electives.title,
      note: electives
        ? `Complete ${electives.requiredCourseCount} out of ${electives.courseIds.length}`
        : "",
      titleId: HeadingIds.RequirementsElectives,
      courseIds: electives.courseIds,
    },
  ].filter((subsec) => subsec !== undefined)

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
          {getCompletionText({
            requiredCount: required?.requiredCourseCount,
            electiveCount: electives?.requiredCourseCount,
          })}
        </Typography>
      </div>
      <Stack gap={{ xs: "32px", sm: "56px" }}>
        {subsections.map(({ title, note, titleId, courseIds }) => (
          <div key={titleId}>
            <ReqSubsectionTitle component="h3" id={titleId}>
              {title}
              {note ? ": " : ""}
              {note ? <ReqTitleNote>{note}</ReqTitleNote> : null}
            </ReqSubsectionTitle>
            <RequirementsListing>
              {courseIds.map((courseId) => {
                const course = coursesById[courseId]
                const isCourseLoading = courses.isLoading || !courses.data
                if (!isCourseLoading && !course) {
                  return null
                }
                return (
                  <li key={courseId}>
                    <MitxOnlineCourseCard
                      course={course}
                      href={`/courses/${encodeURIComponent(course?.readable_id)}`}
                      size="small"
                      isLoading={isCourseLoading}
                      list
                    />
                  </li>
                )
              })}
            </RequirementsListing>
          </div>
        ))}
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

  const courses = useQuery(coursesQueries.coursesForProgram(program))

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

  const navLinks = getNavLinks(page)

  const imageSrc = page.feature_image
    ? page.program_details.page.feature_image_src
    : DEFAULT_RESOURCE_IMG

  const tags = ["MITx", program.program_type].filter((t): t is string => !!t)

  return (
    <ProductPageTemplate
      tags={tags}
      currentBreadcrumbLabel="Program"
      title={page.title}
      shortDescription={
        <DescriptionHTML
          Component="span"
          html={page.program_details.page.description}
        />
      }
      imageSrc={imageSrc}
      summaryTitle="Program summary"
      sidebarSummary={
        <ProgramSummary program={program} courses={courses.data?.results} />
      }
      enrollButton={<ProgramEnrollmentButton program={program} />}
      navbar={<ProductNavbar navLinks={navLinks} productNoun="Program" />}
    >
      {page.about ? (
        <AboutSection productNoun="Program" aboutHtml={page.about} />
      ) : null}
      <RequirementsSection program={program} />
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
