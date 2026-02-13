import React from "react"
import { styled } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { Button } from "@mitodl/smoot-design"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"

const WideButton = styled(Button)({
  width: "100%",
})

const getButtonText = (nextRun?: CourseRunV2) => {
  if (!nextRun || nextRun.is_archived) {
    return "Access Course Materials"
  }
  return "Enroll for Free"
}

type CourseEnrollmentButtonProps = {
  course: CourseWithCourseRunsSerializerV2
}
const CourseEnrollmentButton: React.FC<CourseEnrollmentButtonProps> = ({
  course,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const nextRunId = course.next_run_id
  const nextRun = course.courseruns.find((run) => run.id === nextRunId)

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (me.isLoading) {
      return
    } else if (me.data?.is_authenticated) {
      NiceModal.show(CourseEnrollmentDialog, { course })
    } else {
      setAnchor(e.currentTarget)
    }
  }

  return (
    <>
      <WideButton
        disabled={!nextRun}
        onClick={handleClick}
        variant="primary"
        size="large"
        data-testid="course-enrollment-button"
      >
        {getButtonText(nextRun)}
      </WideButton>
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default CourseEnrollmentButton
