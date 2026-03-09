import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { ProgramSummary } from "./ProductSummary"
import ProgramEnrollmentButton from "./ProgramEnrollmentButton"
import {
  InfoBoxCard,
  InfoBoxContent,
  InfoBoxEnrollArea,
  AskTimButton,
} from "./InfoBoxParts"

type ProgramInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramInfoBox: React.FC<ProgramInfoBoxProps> = ({
  program,
  courses,
}) => {
  return (
    <>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Program Information</h2>
        </VisuallyHidden>
        <InfoBoxContent>
          <ProgramSummary program={program} courses={courses} />
        </InfoBoxContent>
        <InfoBoxEnrollArea>
          <ProgramEnrollmentButton program={program} />
        </InfoBoxEnrollArea>
      </InfoBoxCard>
      <AskTimButton
        variant="bordered"
        size="large"
        startIcon={<RiSparkling2Line />}
        onClick={() => void 0}
        data-testid="ask-tim-button"
      >
        AskTIM about this program
      </AskTimButton>
    </>
  )
}

export default ProgramInfoBox
