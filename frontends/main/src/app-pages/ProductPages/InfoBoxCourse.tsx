import React, { useState } from "react"
import { VisuallyHidden, styled } from "@mitodl/smoot-design"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds } from "./util"
import { CourseSummary } from "./ProductSummary"
import {
  getCourseScenario,
  getEnrollableRuns,
  getSelectedRun,
} from "./courseRun"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import CourseEnrollArea from "./CourseEnrollArea"
import SessionSelect from "./SessionSelect"
import { InfoBoxCard, InfoBoxColumn } from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"

/**
 * Responsive grid that lays out the meta box and offering boxes side-by-side
 * on tablet. On desktop sidebar and mobile it stays single-column.
 *
 * Count-aware CSS:
 *   - data-boxes="3" (Both case): meta spans both columns; paid + free auto-flow.
 *   - data-boxes="1" (no runs): force single column.
 *   - data-boxes="2": auto-flow places meta + one offering box side by side.
 *
 * The "Choose Your Path" heading (emitted by CourseEnrollArea in the Both case)
 * always spans both columns via the .choose-path-heading selector.
 */
const BoxGrid = styled.div(({ theme: t }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px",
  padding: "24px",
  [t.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [t.breakpoints.down("sm")]: {
    padding: "16px",
  },
  [t.breakpoints.between("sm", "md")]: {
    gridTemplateColumns: "1fr 1fr",
    // 3-box (Both): meta spans both columns; offering boxes auto-flow beneath
    "&[data-boxes='3'] [data-grid-meta]": {
      gridColumn: "1 / -1",
    },
    // 1-box (no runs): collapse back to single column
    "&[data-boxes='1']": {
      gridTemplateColumns: "1fr",
    },
  },
}))

type CourseInfoBoxProps = {
  course: CourseWithCourseRunsSerializerV2
}

const CourseInfoBox: React.FC<CourseInfoBoxProps> = ({ course }) => {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const selectedRun = getSelectedRun(course, selectedRunId)
  const { runIds: enrolledRunIds } = useCourseEnrolledRunIds(course)

  const enrollableRuns = getEnrollableRuns(course)
  const sessionSelect =
    enrollableRuns.length > 1 ? (
      <SessionSelect
        runs={enrollableRuns}
        selectedRunId={selectedRun?.id ?? enrollableRuns[0].id}
        enrolledRunIds={enrolledRunIds}
        onChange={setSelectedRunId}
      />
    ) : undefined

  // Compute box count for data-boxes attribute (drives count-aware grid CSS)
  const scenario = getCourseScenario(selectedRun)
  const isEnrolled =
    selectedRun !== undefined && enrolledRunIds.includes(selectedRun.id)
  const offeringBoxes =
    scenario === "none" ? 0 : isEnrolled ? 1 : scenario === "both" ? 2 : 1
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
            />
          </div>
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
