import React from "react"
import type { CourseWithCourseRunsSerializerV2 } from "@mitodl/mitxonline-api-axios/v2"
import { CourseSummary } from "./ProductSummary"
import {
  getCourseScenario,
  getEnrollableRuns,
  getSelectedRun,
} from "./courseRun"
import { offeringBoxCount } from "./enrollTypes"
import { useCourseEnrolledRunIds } from "./useCourseEnrolledRunIds"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import CourseEnrollArea from "./CourseEnrollArea"
import SessionSelect from "./SessionSelect"
import InfoBoxLayout from "./InfoBoxLayout"

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

  const scenario = getCourseScenario(selectedRun)
  const isEnrolled =
    selectedRun !== undefined && enrolledRunIds.includes(selectedRun.id)
  const offeringBoxes = offeringBoxCount(scenario.offering, isEnrolled)

  const upsell = course.programs?.length ? (
    <ProgramBundleUpsell programs={course.programs} />
  ) : null

  return (
    <InfoBoxLayout
      heading="Course Information"
      offeringBoxes={offeringBoxes}
      summary={({ tabletColumns }) => (
        <CourseSummary
          course={course}
          selectedRun={selectedRun}
          sessionSelect={sessionSelect}
          tabletColumns={tabletColumns}
        />
      )}
      enrollArea={
        <CourseEnrollArea course={course} selectedRun={selectedRun} />
      }
      upsell={upsell}
      askTim={{ readableId: course.readable_id, resourceType: "course" }}
    />
  )
}

export default CourseInfoBox
