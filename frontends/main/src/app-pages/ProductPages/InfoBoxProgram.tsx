import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { ProgramSummary } from "./ProductSummary"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import {
  InfoBoxActionStack,
  InfoBoxCard,
  InfoBoxColumn,
  InfoBoxContent,
  InfoBoxEnrollArea,
} from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"

type ProgramInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramInfoBox: React.FC<ProgramInfoBoxProps> = ({
  program,
  courses,
}) => {
  return (
    <InfoBoxColumn>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Program Information</h2>
        </VisuallyHidden>
        <InfoBoxContent>
          <ProgramSummary program={program} courses={courses} />
        </InfoBoxContent>
        <InfoBoxEnrollArea>
          <InfoBoxActionStack>
            <ProgramEnrollmentButton program={program} variant="primary" />
          </InfoBoxActionStack>
        </InfoBoxEnrollArea>
      </InfoBoxCard>
      <ProductPageAskTimSection
        readableId={program.readable_id}
        resourceType="program"
      />
    </InfoBoxColumn>
  )
}

export default ProgramInfoBox
