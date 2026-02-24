import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import CourseComplete from "@/public/images/icons/course-complete.svg"
import CourseInProgress from "@/public/images/icons/course-in-progress.svg"
import CourseUnenrolled from "@/public/images/icons/course-unenrolled.svg"
import { EnrollmentStatus } from "./helpers"

const CompletedImage = styled(Image)({
  width: "16px",
  height: "16px",
})
const Ring = styled.div(({ theme }) => ({
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  padding: "2px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  img: {
    width: "100%",
    height: "100%",
  },
}))

type EnrollmentStatusIndicatorProps = {
  status: EnrollmentStatus
  showNotComplete?: boolean
}
const EnrollmentStatusIndicator: React.FC<EnrollmentStatusIndicatorProps> = ({
  status,
  showNotComplete,
}) => {
  if (status === EnrollmentStatus.Completed) {
    return (
      <span data-testid="enrollment-status">
        <CompletedImage
          src={CourseComplete}
          alt=""
          // use VisuallyHidden text for consistency with the non-image case.
          aria-hidden
        />
        <VisuallyHidden>Completed</VisuallyHidden>
      </span>
    )
  }
  if (!showNotComplete) return

  if (status === EnrollmentStatus.Enrolled) {
    return (
      <Ring data-testid="enrollment-status">
        <Image
          src={CourseInProgress}
          alt=""
          // use VisuallyHidden text for consistency with the non-image case.
          aria-hidden
        />
        <VisuallyHidden>Enrolled</VisuallyHidden>
      </Ring>
    )
  }

  return (
    <Ring data-testid="enrollment-status">
      <Image
        src={CourseUnenrolled}
        alt=""
        // use VisuallyHidden text for consistency with the non-image case.
        aria-hidden
      />
      <VisuallyHidden>Not Enrolled</VisuallyHidden>
    </Ring>
  )
}

export { EnrollmentStatusIndicator }
export type { EnrollmentStatusIndicatorProps }
