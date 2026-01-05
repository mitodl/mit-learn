"use client"

import React from "react"
import { PlainList, Skeleton, Stack, Typography } from "ol-components"
import { ResourceCard } from "@/page-components/ResourceCard/ResourceCard"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { notFound } from "next/navigation"
import { HeadingIds, parseReqTree } from "./util"
import InstructorsSection from "./InstructorsSection"
import RawHTML, { UnstyledRawHTML } from "./RawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate, {
  HeadingData,
  ProductNavbar,
  WhoCanTake,
} from "./ProductPageTemplate"
import { ProgramPageItem, V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { ProgramSummary } from "./ProductSummary"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { learningResourceQueries } from "api/hooks/learningResources"
import { ResourceTypeEnum } from "api"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import dynamic from "next/dynamic"
import type { Breakpoint } from "@mui/system"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

type ProgramPageProps = {
  readableId: string
}

const WhatSection = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})
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
      id: HeadingIds.Requirements,
      label: "Courses",
      variant: "secondary",
      content: true,
    },
    {
      id: HeadingIds.What,
      label: "What you'll learn",
      variant: "secondary",
      content: page.what_you_learn,
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
      content: page.faculty.length ? "x" : undefined,
    },
  ] as const
  return all.filter((item) => item.content)
}

const DescriptionHTML = styled(UnstyledRawHTML)({
  p: { margin: 0 },
})

const RequirementsListing = styled(PlainList)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: "24px",
  flexWrap: "wrap",
  marginTop: "24px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const keyBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T> => {
  return Object.fromEntries(array.map((item) => [String(item[key]), item]))
}

const StyledResourceCard = styled(ResourceCard)<{
  onlyAbove?: Breakpoint
  onlyBelow?: Breakpoint
}>(({ theme, onlyAbove, onlyBelow }) => ({
  ...(onlyAbove
    ? { [theme.breakpoints.down(onlyAbove)]: { display: "none" } }
    : null),
  ...(onlyBelow
    ? { [theme.breakpoints.up(onlyBelow)]: { display: "none" } }
    : null),
}))

type RequirementSubsectionInfo = {
  title: string
  note?: string
  titleId: string
  resourceIds: string[]
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
const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  program,
}) => {
  const requirements = program.requirements

  const readable = {
    required:
      requirements.courses?.required
        ?.map((c) => c.readable_id)
        .filter((id) => id !== undefined) ?? [],
    elective:
      requirements.courses?.electives
        ?.map((c) => c.readable_id)
        .filter((id) => id !== undefined) ?? [],
  }
  const readableIds = [...(readable.required ?? []), ...readable.elective]
  const resources = useQuery({
    ...learningResourceQueries.list({
      readable_id: readableIds,
      platform: ["mitxonline"],
      resource_type: [ResourceTypeEnum.Course],
      limit: readableIds.length,
    }),
    enabled: readableIds.length > 0,
    select: (data) => keyBy(data.results, "readable_id"),
  })

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
      resourceIds: readable.required,
    },
    electives && {
      title: electives.title,
      note: electives
        ? `Complete ${electives.requiredCourseCount} out of ${electives.courseIds.length}`
        : "",
      titleId: HeadingIds.RequirementsElectives,
      resourceIds: readable.elective,
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
          {electives
            ? `To complete this program, you must take ${readable.required.length} required courses and ${electives.requiredCourseCount} elective courses.`
            : `To complete this program, you must take ${readable.required.length} required courses.`}
        </Typography>
      </div>
      <Stack gap={{ xs: "32px", sm: "56px" }}>
        {subsections.map(({ title, note, titleId, resourceIds }) => (
          <div key={titleId}>
            <ReqSubsectionTitle component="h3" id={titleId}>
              {title}
              {note ? ": " : ""}
              {note ? <ReqTitleNote>{note}</ReqTitleNote> : null}
            </ReqSubsectionTitle>
            <RequirementsListing>
              {resourceIds.map((readableId) => {
                const resource = resources.data?.[readableId]
                if (!resources.isLoading && !resource) return null
                return (
                  <li key={readableId}>
                    <StyledResourceCard
                      onlyAbove="sm"
                      resource={resource}
                      size="small"
                      isLoading={resources.isLoading}
                    />
                    <StyledResourceCard
                      onlyBelow="sm"
                      list
                      resource={resource}
                      size="small"
                      isLoading={resources.isLoading}
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
  const programResources = useQuery(
    learningResourceQueries.list({
      readable_id: [readableId],
      resource_type: [ResourceTypeEnum.Program],
    }),
  )

  const page = pages.data?.items[0]
  const program = programs.data?.results?.[0]
  const programResource = programResources.data?.results?.[0]
  const enabled = useFeatureFlagEnabled(FeatureFlags.MitxOnlineProductPages)
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!enabled) {
    return flagsLoaded ? notFound() : null
  }

  const isLoading =
    pages.isLoading || programs.isLoading || programResources.isLoading

  if (!page || !program || !programResource) {
    if (!isLoading) {
      return notFound()
    } else {
      return <Skeleton width="100%" height="100px" />
    }
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
      sidebarSummary={
        <ProgramSummary
          enrollButton={<ProgramEnrollmentButton program={program} />}
          program={program}
          programResource={programResource}
        />
      }
      navLinks={navLinks}
    >
      <ProductNavbar navLinks={navLinks} productNoun="Program" />
      <Stack gap={{ xs: "40px", sm: "56px" }}>
        {page.about ? (
          <AboutSection productNoun="Program" aboutHtml={page.about} />
        ) : null}
        <RequirementsSection program={program} />
        {page.what_you_learn ? (
          <WhatSection aria-labelledby={HeadingIds.What}>
            <Typography variant="h4" component="h2" id={HeadingIds.What}>
              What you'll learn
            </Typography>
            <RawHTML html={page.what_you_learn} />
          </WhatSection>
        ) : null}
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
        <WhoCanTake productNoun="Program" />
      </Stack>
      <LearningResourceDrawer />
    </ProductPageTemplate>
  )
}

export default ProgramPage
