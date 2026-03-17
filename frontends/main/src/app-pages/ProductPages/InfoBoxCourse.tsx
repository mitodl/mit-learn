import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { CourseSummary } from "./ProductSummary"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import { InfoBoxCard, InfoBoxContent, InfoBoxEnrollArea } from "./InfoBoxParts"

type CourseInfoBoxProps = {
  course: CourseWithCourseRunsSerializerV2
}

const CourseInfoBox: React.FC<CourseInfoBoxProps> = ({ course }) => {
  return (
    <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
      <VisuallyHidden>
        <h2 id={HeadingIds.Summary}>Course Information</h2>
      </VisuallyHidden>
      <InfoBoxContent>
        <CourseSummary course={course} />
      </InfoBoxContent>
      <InfoBoxEnrollArea>
        <CourseEnrollmentButton course={course} />
      </InfoBoxEnrollArea>
      {course.programs?.length ? (
        <ProgramBundleUpsell programs={course.programs} />
      ) : null}
    </InfoBoxCard>
  )
}

export default CourseInfoBox
