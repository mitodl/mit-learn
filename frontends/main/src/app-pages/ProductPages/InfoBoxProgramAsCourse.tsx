import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { ProgramAsCourseSummary } from "./ProductSummary"
import { getProgramOffering, programOfferingBoxCount } from "./programOffering"
import { useProgramIsEnrolled } from "./useProgramIsEnrolled"
import ProgramEnrollArea from "./ProgramEnrollArea"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import { InfoBoxCard, InfoBoxColumn } from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"
import { BoxGrid, SectionDivider } from "./InfoBoxGrid"

type ProgramAsCourseInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

const ProgramAsCourseInfoBox: React.FC<ProgramAsCourseInfoBoxProps> = ({
  program,
  courses,
}) => {
  // data-boxes drives the count-aware grid CSS below; programOfferingBoxCount
  // owns the enrolled/offering → count mapping. Same sources (getProgramOffering,
  // useProgramIsEnrolled) that useProgramEnrollment uses internally, so the grid
  // can't disagree with what ProgramEnrollArea renders — React Query dedupes the
  // underlying queries.
  const offering = getProgramOffering(program)
  const { isEnrolled } = useProgramIsEnrolled(program)
  const offeringBoxes = programOfferingBoxCount(offering, isEnrolled)
  const boxCount = 1 + offeringBoxes // 1 | 2 | 3

  const upsell = program.programs?.length ? (
    <ProgramBundleUpsell programs={program.programs} />
  ) : null

  return (
    <InfoBoxColumn>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course Information</h2>
        </VisuallyHidden>
        <BoxGrid data-boxes={boxCount}>
          <div data-grid-meta>
            <ProgramAsCourseSummary program={program} courses={courses} />
          </div>
          {offeringBoxes > 0 ? <SectionDivider /> : null}
          <ProgramEnrollArea program={program} displayAsCourse />
        </BoxGrid>
        {upsell}
      </InfoBoxCard>
      <ProductPageAskTimSection
        readableId={program.readable_id}
        resourceType="program"
      />
    </InfoBoxColumn>
  )
}

export default ProgramAsCourseInfoBox
