"use client"

import React, { useEffect } from "react"
import { PlainList, Stack, Typography } from "ol-components"

import { pagesQueries } from "api/mitxonline-hooks/pages"
import { useQuery } from "@tanstack/react-query"
import { styled, VisuallyHidden } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { notFound } from "next/navigation"
import { HeadingIds, parseReqTree, RequirementData } from "./util"
import useReqTreeChildren from "./useReqTreeChildren"
import InstructorsSection from "./InstructorsSection"
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
import MitxOnlineResourceCard from "./MitxOnlineResourceCard"
import ProgramHeaderEnrollButton from "./ProgramHeaderEnrollButton"
import { trackCourseProgramView } from "@/common/analytics/gtm"
import { keyBy } from "lodash"
import { coursePageView, programPageView } from "@/common/urls"

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

const RequirementsListing = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
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
  childPrograms?: V2ProgramDetail[]
  isLoading?: boolean
  showCourseFraming?: boolean
}

// Says "courses" for child programs too: those with display_mode="course" are
// presented as courses here and on their own product pages.
const getCompletionText = (parsedReqs: RequirementData[]) => {
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

const getRequirementSectionSubtitle = (reqData: RequirementData) => {
  if (reqData.requiredCount === 0 && reqData.items.length > 0) {
    return null
  }
  if (reqData.requiredCount < reqData.items.length) {
    return `Complete ${reqData.requiredCount} out of ${reqData.items.length}`
  }
  return null
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
  const parsedReqs = parseReqTree(program.req_tree)

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
            {getCompletionText(parsedReqs)}
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
                {req.items.map((item) => {
                  if (item.type === "course") {
                    const course = coursesById[item.id]
                    if (!isLoading && !course) return null
                    return (
                      <li key={`course-${item.id}`}>
                        <MitxOnlineResourceCard
                          resource={course}
                          resourceType="course"
                          href={
                            course ? coursePageView(course.readable_id) : ""
                          }
                          size="small"
                          isLoading={isLoading}
                          label={req.title}
                          list
                        />
                      </li>
                    )
                  }
                  const prog = programsById[item.id]
                  if (!isLoading && !prog) return null
                  return (
                    <li key={`program-${item.id}`}>
                      <MitxOnlineResourceCard
                        resource={prog}
                        resourceType="program"
                        href={
                          prog
                            ? programPageView({
                                readable_id: prog.readable_id,
                                display_mode: prog.display_mode,
                              })
                            : ""
                        }
                        size="small"
                        isLoading={isLoading}
                        label={req.title}
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

export default ProgramPage
