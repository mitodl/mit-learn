import React from "react"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { ProgramSummary, ProgramAsCourseSummary } from "./ProductSummary"
import { getProgramOffering } from "./programOffering"
import { offeringBoxCount } from "./enrollTypes"
import { useProgramIsEnrolled } from "./useProgramIsEnrolled"
import ProgramEnrollArea from "./ProgramEnrollArea"
import ProgramBundleUpsell from "./ProgramBundleUpsell"
import InfoBoxLayout from "./InfoBoxLayout"

type ProgramInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  /**
   * Present a course-like program (display_mode="Course") as a course: "Course
   * Information" heading, the course-style metadata block, and the bundle upsell
   * for its parent program(s).
   */
  displayAsCourse?: boolean
}

const ProgramInfoBox: React.FC<ProgramInfoBoxProps> = ({
  program,
  courses,
  displayAsCourse,
}) => {
  const offering = getProgramOffering(program)
  const { isEnrolled } = useProgramIsEnrolled(program)
  const offeringBoxes = offeringBoxCount(offering, isEnrolled)

  // The bundle upsell only appears in the program-as-course presentation, and
  // only when this program is itself part of a parent program. Full program
  // pages have never shown it.
  const upsell =
    displayAsCourse && program.programs?.length ? (
      <ProgramBundleUpsell programs={program.programs} />
    ) : null

  return (
    <InfoBoxLayout
      heading={displayAsCourse ? "Course Information" : "Program Information"}
      offeringBoxes={offeringBoxes}
      summary={({ tabletColumns }) =>
        displayAsCourse ? (
          <ProgramAsCourseSummary
            program={program}
            courses={courses}
            tabletColumns={tabletColumns}
          />
        ) : (
          <ProgramSummary
            program={program}
            courses={courses}
            tabletColumns={tabletColumns}
          />
        )
      }
      enrollArea={
        <ProgramEnrollArea
          program={program}
          displayAsCourse={displayAsCourse}
        />
      }
      upsell={upsell}
      askTim={{ readableId: program.readable_id, resourceType: "program" }}
    />
  )
}

export default ProgramInfoBox
