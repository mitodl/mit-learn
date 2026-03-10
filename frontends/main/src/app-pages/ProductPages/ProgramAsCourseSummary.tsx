import React from "react"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  ProgramDurationRow,
  ProgramPaceRow,
  ProgramPriceRow,
  SummaryRows,
  TestIds,
} from "./ProductSummary"

type ProgramAsCourseSummaryProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramAsCourseSummary: React.FC<ProgramAsCourseSummaryProps> = ({
  program,
  courses,
}) => {
  return (
    <SummaryRows>
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
      <ProgramPriceRow data-testid={TestIds.PriceRow} program={program} />
    </SummaryRows>
  )
}

export default ProgramAsCourseSummary
