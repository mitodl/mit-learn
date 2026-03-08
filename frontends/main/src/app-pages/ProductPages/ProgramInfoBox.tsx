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
  SummaryCard,
  SummaryContent,
  EnrollArea,
  AskTimButton,
} from "./CourseInfoBox"

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
      <SummaryCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Program summary</h2>
        </VisuallyHidden>
        <SummaryContent>
          <ProgramSummary program={program} courses={courses} />
        </SummaryContent>
        <EnrollArea>
          <ProgramEnrollmentButton program={program} />
        </EnrollArea>
      </SummaryCard>
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
