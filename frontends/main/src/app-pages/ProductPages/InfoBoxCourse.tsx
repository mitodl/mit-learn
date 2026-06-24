import React from "react"
import { VisuallyHidden, styled } from "@mitodl/smoot-design"
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
 * always spans both columns via the [data-choose-path] selector.
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
    // 3-box (Both): "Choose Your Path" heading spans both columns
    "&[data-boxes='3'] [data-choose-path]": {
      gridColumn: "1 / -1",
    },
    // 1-box (no runs): collapse back to single column
    "&[data-boxes='1']": {
      gridTemplateColumns: "1fr",
    },
    // 3-box (Both): the two offering cells share a row and already stretch to
    // equal height (grid default), but the bordered card inside each is only
    // content-height — so the shorter (free) card's box ends early. Make each
    // card's flex chain fill its stretched cell and drop the CTA to the bottom,
    // so the two boxes match height and their buttons align. Reaches into the
    // card structure: [data-card] cell > CardShell > CardBody > (…content, CTA
    // last). Tablet-only; on the single-column grid the cells are content-height
    // and flexGrow is a no-op, so this is scoped here rather than in the cards.
    "&[data-boxes='3'] [data-card] > *": {
      flexGrow: 1, // CardShell fills the stretched cell
    },
    "&[data-boxes='3'] [data-card] > * > *": {
      flexGrow: 1, // CardBody fills CardShell
      justifyContent: "flex-start",
    },
    "&[data-boxes='3'] [data-card] > * > * > :last-child": {
      marginTop: "auto", // CTA to the bottom
    },
  },
}))

/**
 * Full-width rule separating the metadata block from the "Choose Your Path"
 * offering(s). Single-column only — hidden in the tablet 2-column grid, where
 * meta and offerings sit side by side and a horizontal rule would not apply.
 */
const SectionDivider = styled.hr(({ theme: t }) => ({
  border: "none",
  borderTop: `1px solid ${t.custom.colors.lightGray2}`,
  width: "100%",
  margin: 0,
  gridColumn: "1 / -1",
  [t.breakpoints.between("sm", "md")]: {
    display: "none",
  },
}))

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

  // data-boxes drives the count-aware grid CSS below. offeringBoxCount owns the
  // enrolled/offering → count mapping so the layout can't disagree with what
  // CourseEnrollArea renders (an enrolled user collapses to one box even on a
  // degraded "none" run).
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
