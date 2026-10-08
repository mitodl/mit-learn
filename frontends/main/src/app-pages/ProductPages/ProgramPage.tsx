"use client"

import React, { useEffect } from "react"
import { Stack, Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled, VisuallyHidden } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { notFound } from "next/navigation"
import {
  getRequirementSectionSubtitle,
  HeadingIds,
  parseReqTree,
  RequirementData,
} from "./util"
import useReqTreeChildren from "./useReqTreeChildren"
import InstructorsSection from "./InstructorsSection"
import FaqsSection from "./FaqsSection"
import TestimonialsSection from "./TestimonialsSection"
import RawHTML from "./RawHTML"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import AboutSection from "./AboutSection"
import ProductPageTemplate from "./ProductPageTemplate"
import WhatYoullLearnSection from "./WhatYoullLearnSection"
import HowYoullLearnSection from "./HowYoullLearnSection"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, pluralize } from "ol-utilities"
import ProgramInfoBox from "./InfoBoxProgram"
import RequirementItemCard from "./RequirementItemCard"
import {
  RequirementsListing,
  ReqSubsectionTitle,
  ReqTitleNote,
} from "./RequirementStyles"
import ProgramTracksSection from "./ProgramTracksSection"
import ProgramTrackCompareSection from "./ProgramTrackCompareSection"
import ProgramHeaderEnrollButton from "./ProgramHeaderEnrollButton"
import { trackCourseProgramView } from "@/common/analytics/gtm"
import { keyBy } from "lodash"
import { parseTrackedProgramRequirements } from "@/common/mitxonline"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

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

type RequirementsSectionProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  childPrograms?: V2ProgramDetail[]
  isLoading?: boolean
  showCourseFraming?: boolean
}

// Says "courses" for child programs too: those with display_mode="course" are
// presented as courses here and on their own product pages.
const getBaseCompletionText = (parsedReqs: RequirementData[]) => {
  let requiredCount = 0
  let requiredElectiveCount = 0
  let totalElectives = 0
  parsedReqs.forEach((req) => {
    if (req.elective) {
      requiredElectiveCount += req.requiredCount
      totalElectives += req.items.length
    } else {
      requiredCount += req.requiredCount
    }
  })
  if (requiredCount && requiredElectiveCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)} and ${requiredElectiveCount} elective ${pluralize("course", requiredElectiveCount)}.`
  }
  if (requiredCount && totalElectives > 0) {
    return `To complete this program, you must take ${requiredCount} required courses. Additional elective courses are available.`
  }
  if (requiredCount) {
    return `To complete this program, you must take ${requiredCount} required ${pluralize("course", requiredCount)}.`
  }
  if (requiredElectiveCount) {
    return `To complete this program, you must take ${requiredElectiveCount} ${pluralize("course", requiredElectiveCount)}.`
  }
  return ""
}

// For a tracked program, `parsedReqs` excludes the tracks container and
// `trackCount` adds a clause for it. The product page design uses
// author-written copy instead ("The program includes 3 core courses and 1
// track with 2 electives."); that waits on a ProgramPage CMS field mitxonline
// doesn't have yet, so this generated sentence stands in for now.
const getCompletionText = (
  parsedReqs: RequirementData[],
  trackCount: number = 0,
) => {
  const base = getBaseCompletionText(parsedReqs)
  if (!trackCount) return base
  const trackClause = `complete 1 of ${trackCount} ${pluralize("track", trackCount)}`
  return base
    ? `${base.replace(/\.$/, "")}, and ${trackClause}.`
    : `To complete this program, you must ${trackClause}.`
}

const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  program,
  courses,
  childPrograms,
  isLoading,
  showCourseFraming = true,
}) => {
  const coursesById = keyBy(courses ?? [], "id")
  const programsById = keyBy(childPrograms ?? [], "id")
  const showTracks = useFeatureFlagEnabled(
    FeatureFlags.ProgramTracksProductPage,
  )
  const tracked = parseTrackedProgramRequirements(program.req_tree)
  const allReqs = parseReqTree(program.req_tree)
  // The tracks container is a "choose 1" group whose children are tracks, not
  // courses, so it must not be counted or rendered as an ordinary group.
  const parsedReqs = tracked
    ? allReqs.filter((req) => req.id !== tracked.container.id)
    : allReqs
  const trackCount = showTracks && tracked ? tracked.tracks.length : 0

  const renderReq = (req: RequirementData) => {
    const note = getRequirementSectionSubtitle(req)
    return (
      <div key={req.id}>
        <ReqSubsectionTitle component="h3">
          {req.title}
          {note ? ": " : ""}
          {note ? <ReqTitleNote>{note}</ReqTitleNote> : null}
        </ReqSubsectionTitle>
        <RequirementsListing>
          {req.items.map((item) => (
            <RequirementItemCard
              key={`${item.type}-${item.id}`}
              item={item}
              coursesById={coursesById}
              programsById={programsById}
              isLoading={!!isLoading}
              label={req.title}
            />
          ))}
        </RequirementsListing>
      </div>
    )
  }

  return (
    <Stack
      gap={{ xs: "24px", sm: "32px" }}
      component="section"
      aria-labelledby={HeadingIds.Requirements}
    >
      {showCourseFraming ? (
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
            {getCompletionText(parsedReqs, trackCount)}
          </Typography>
        </div>
      ) : (
        /* Nothing visible introduces the groups, but the section's
           aria-labelledby still needs a target. */
        <VisuallyHidden as="h2" id={HeadingIds.Requirements}>
          Requirements
        </VisuallyHidden>
      )}
      <Stack gap={{ xs: "32px", sm: "56px" }}>
        {allReqs.map((req) => {
          if (tracked && req.id === tracked.container.id) {
            // Behind its flag until Learn's track UI ships; with the flag
            // off a tracked program shows only its groups outside the tracks.
            return showTracks ? (
              <ProgramTracksSection
                key={req.id}
                tracks={tracked.tracks}
                coursesById={coursesById}
                programsById={programsById}
                isLoading={!!isLoading}
              />
            ) : null
          }
          return renderReq(req)
        })}
      </Stack>
    </Stack>
  )
}

const PROGRAM_TYPE_DISPLAY: Record<string, string> = {
  "MicroMasters®": "MicroMasters®",
  MicroMasters: "MicroMasters®",
}

const formatProgramTypeLabel = (
  programType: string | null | undefined,
): string | undefined => {
  if (!programType) return undefined
  return PROGRAM_TYPE_DISPLAY[programType]
}

const ProgramPage: React.FC<ProgramPageProps> = ({ readableId }) => {
  const pages = useQuery(pagesQueries.programPages(readableId))
  const programs = useQuery(
    programsQueries.programsList({ readable_id: readableId, live: true }),
  )

  const page = pages.data?.items[0]
  const program = programs.data?.results?.[0]

  const {
    courses,
    programs: childPrograms,
    isLoading: dataLoading,
    allChildrenAreCourseLike: showCourseFraming,
  } = useReqTreeChildren(program)

  useEffect(() => {
    if (!program) return
    trackCourseProgramView({ name: program.title, id: program.readable_id })
  }, [program])

  const isLoading = pages.isLoading || programs.isLoading

  if (!page || !program) {
    if (!isLoading) {
      return notFound()
    }
    return null
  }

  const imageSrc =
    page.program_details.page?.feature_image_src || DEFAULT_RESOURCE_IMG

  return (
    <ProductPageTemplate
      currentBreadcrumbLabel="Program"
      label={formatProgramTypeLabel(program.program_type)}
      title={page.title}
      shortDescription={
        <DescriptionHTML
          Component="span"
          html={page.program_details.page?.description ?? ""}
        />
      }
      imageSrc={imageSrc}
      videoUrl={page.video_url}
      enrollmentAction={<ProgramHeaderEnrollButton program={program} />}
      resource={{
        readable_id: program.readable_id,
        resource_type: "program",
      }}
      hubspotFormId={page.hubspot_form_id}
      infoBox={
        <ProgramInfoBox
          program={program}
          courses={courses}
          showCourseFraming={showCourseFraming}
        />
      }
    >
      {page.about ? (
        <AboutSection productNoun="Program" aboutHtml={page.about} />
      ) : null}
      {page.what_you_learn ? (
        <WhatYoullLearnSection html={page.what_you_learn} />
      ) : null}
      <RequirementsSection
        program={program}
        courses={courses}
        childPrograms={childPrograms}
        isLoading={dataLoading}
        showCourseFraming={showCourseFraming}
      />
      <ProgramTrackCompareSection
        program={program}
        courses={courses}
        childPrograms={childPrograms}
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
      {page.faqs.length ? <FaqsSection faqs={page.faqs} /> : null}
      {page.testimonials.length ? (
        <TestimonialsSection testimonials={page.testimonials} />
      ) : null}
    </ProductPageTemplate>
  )
}

export default ProgramPage
