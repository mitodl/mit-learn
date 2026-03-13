import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { ProgramAsCourseSummary } from "./ProductSummary"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import { InfoBoxCard, InfoBoxContent, InfoBoxEnrollArea } from "./InfoBoxParts"

type ProgramAsCourseInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramAsCourseInfoBox: React.FC<ProgramAsCourseInfoBoxProps> = ({
  program,
  courses,
}) => {
  return (
    <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
      <VisuallyHidden>
        <h2 id={HeadingIds.Summary}>Course Information</h2>
      </VisuallyHidden>
      <InfoBoxContent>
        <ProgramAsCourseSummary program={program} courses={courses} />
      </InfoBoxContent>
      <InfoBoxEnrollArea>
        <ProgramEnrollmentButton program={program} />
      </InfoBoxEnrollArea>
    </InfoBoxCard>
  )
}

export default ProgramAsCourseInfoBox
