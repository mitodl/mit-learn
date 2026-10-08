import React from "react"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import MitxOnlineResourceCard from "./MitxOnlineResourceCard"
import { coursePageView, programPageView } from "@/common/urls"
import type { RequirementItem } from "./util"

type RequirementItemCardProps = {
  item: RequirementItem
  coursesById: Record<number, CourseWithCourseRunsSerializerV2>
  programsById: Record<number, V2ProgramDetail>
  isLoading: boolean
  label: string
}

/**
 * A list item holding the card for one course or program in a requirement
 * group. Renders nothing once loading finishes if the resource wasn't found.
 */
const RequirementItemCard: React.FC<RequirementItemCardProps> = ({
  item,
  coursesById,
  programsById,
  isLoading,
  label,
}) => {
  if (item.type === "course") {
    const course = coursesById[item.id]
    if (!isLoading && !course) return null
    return (
      <li>
        <MitxOnlineResourceCard
          resource={course}
          resourceType="course"
          href={course ? coursePageView(course.readable_id) : ""}
          size="small"
          isLoading={isLoading}
          label={label}
          list
        />
      </li>
    )
  }
  const prog = programsById[item.id]
  if (!isLoading && !prog) return null
  return (
    <li>
      <MitxOnlineResourceCard
        resource={prog}
        resourceType="program"
        href={
          prog
            ? programPageView({
                readable_id: prog.readable_id,
                display_mode: prog.display_mode,
              })
            : ""
        }
        size="small"
        isLoading={isLoading}
        label={label}
        list
      />
    </li>
  )
}

export default RequirementItemCard
