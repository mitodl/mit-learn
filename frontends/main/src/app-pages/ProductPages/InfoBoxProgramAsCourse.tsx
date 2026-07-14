import React from "react"
import type {
  V2ProgramDetail,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import ProgramInfoBox from "./InfoBoxProgram"

type ProgramAsCourseInfoBoxProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
}

/**
 * A course-like program (display_mode="Course") presented as a course. Thin
 * wrapper over ProgramInfoBox — see its `displayAsCourse` prop.
 */
const ProgramAsCourseInfoBox: React.FC<ProgramAsCourseInfoBoxProps> = ({
  program,
  courses,
}) => <ProgramInfoBox program={program} courses={courses} displayAsCourse />

export default ProgramAsCourseInfoBox
