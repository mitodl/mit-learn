import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { CourseSummary, ProgramBundleUpsell } from "./ProductSummary"
import CourseEnrollmentButton from "./CourseEnrollmentButton"
import {
  InfoBoxCard,
  InfoBoxContent,
  InfoBoxEnrollArea,
  AskTimButton,
} from "./InfoBoxParts"

type CourseInfoBoxProps = {
  course: CourseWithCourseRunsSerializerV2
}

const CourseInfoBox: React.FC<CourseInfoBoxProps> = ({ course }) => {
  return (
    <>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course summary</h2>
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
      <AskTimButton
        variant="bordered"
        size="large"
        startIcon={<RiSparkling2Line />}
        onClick={() => void 0}
        data-testid="ask-tim-button"
      >
        AskTIM about this course
      </AskTimButton>
    </>
  )
}

export default CourseInfoBox
