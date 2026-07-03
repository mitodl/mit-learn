import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { CourseSummary } from "./ProductSummary"
import {
  getCourseScenario,
  getEnrollableRuns,
  getSelectedRun,
  offeringBoxCount,
} from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import CourseEnrollArea from "./CourseEnrollArea"
import SessionSelect from "./SessionSelect"
import { InfoBoxCard, InfoBoxColumn } from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"
import { BoxGrid, SectionDivider } from "./InfoBoxGrid"

type CourseInfoBoxProps = {
  course: CourseWithCourseRunsSerializerV2
  selectedRunId: number | null
  onSelectRun: (runId: number) => void
}

const CourseInfoBox: React.FC<CourseInfoBoxProps> = ({
  course,
  selectedRunId,
  onSelectRun,
}) => {
  const selectedRun = getSelectedRun(course, selectedRunId)
  const { runIds: enrolledRunIds } = useCourseEnrolledRunIds(course)

  const enrollableRuns = getEnrollableRuns(course)
  const sessionSelect =
    enrollableRuns.length > 1 ? (
      <SessionSelect
        runs={enrollableRuns}
        selectedRunId={selectedRun?.id ?? enrollableRuns[0].id}
        enrolledRunIds={enrolledRunIds}
        onChange={onSelectRun}
      />
    ) : undefined

  // data-boxes drives the count-aware grid CSS below; offeringBoxCount owns the
  // enrolled/offering → count mapping.
  const scenario = getCourseScenario(selectedRun)
  const isEnrolled =
    selectedRun !== undefined && enrolledRunIds.includes(selectedRun.id)
  const offeringBoxes = offeringBoxCount(scenario, isEnrolled)
  const boxCount = 1 + offeringBoxes // 1 | 2 | 3

  const upsell = course.programs?.length ? (
    <ProgramBundleUpsell programs={course.programs} />
  ) : null

  return (
    <InfoBoxColumn>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>Course Information</h2>
        </VisuallyHidden>
        <BoxGrid data-boxes={boxCount}>
          <div data-grid-meta>
            <CourseSummary
              course={course}
              selectedRun={selectedRun}
              sessionSelect={sessionSelect}
              // 2-box layout puts metadata in a half-width cell — keep it linear.
              tabletColumns={boxCount === 2 ? 1 : 2}
            />
          </div>
          {offeringBoxes > 0 ? <SectionDivider /> : null}
          <CourseEnrollArea course={course} selectedRun={selectedRun} />
        </BoxGrid>
        {upsell}
      </InfoBoxCard>
      <ProductPageAskTimSection
        readableId={course.readable_id}
        resourceType="course"
      />
    </InfoBoxColumn>
  )
}

export default CourseInfoBox
