import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { ProgramAsCourseSummary } from "./ProductSummary"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import {
  InfoBoxActionStack,
  InfoBoxCard,
  InfoBoxColumn,
  InfoBoxContent,
  InfoBoxEnrollArea,
} from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"

type ProgramAsCourseInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramAsCourseInfoBox: React.FC<ProgramAsCourseInfoBoxProps> = ({
  program,
  courses,
}) => {
  return (
    <InfoBoxColumn>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course Information</h2>
        </VisuallyHidden>
        <InfoBoxContent>
          <ProgramAsCourseSummary program={program} courses={courses} />
        </InfoBoxContent>
        <InfoBoxEnrollArea>
          <InfoBoxActionStack>
            <ProgramEnrollmentButton program={program} displayAsCourse />
          </InfoBoxActionStack>
        </InfoBoxEnrollArea>
        {program.programs?.length ? (
          <ProgramBundleUpsell programs={program.programs} />
        ) : null}
      </InfoBoxCard>
      <ProductPageAskTimSection
        readableId={program.readable_id}
        resourceType="program"
      />
    </InfoBoxColumn>
  )
}

export default ProgramAsCourseInfoBox
