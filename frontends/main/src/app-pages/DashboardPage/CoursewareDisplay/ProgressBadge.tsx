import React from "react"
import { styled, Typography } from "ol-components"
import { EnrollmentStatus } from "./helpers"
import { RiCheckLine } from "@remixicon/react"

const BadgeContainer = styled("div")<{
  status: EnrollmentStatus
}>(({ theme, status }) => {
  let backgroundColor = theme.custom.colors.lightGray1
  let color = theme.custom.colors.silverGrayDark

  if (status === EnrollmentStatus.Completed) {
    backgroundColor = `${theme.custom.colors.black}0A`
  } else if (status === EnrollmentStatus.Enrolled) {
    backgroundColor = `${theme.custom.colors.red}0A`
    color = theme.custom.colors.red
  }

  return {
    display: "flex",
    minWidth: "80px",
    padding: "4px 8px",
    borderRadius: "4px",
    justifyContent: "center",
    alignItems: "center",
    gap: "4px",
    whiteSpace: "nowrap",
    backgroundColor,
    color,
  }
})

interface ProgressBadgeProps {
  enrollmentStatus: EnrollmentStatus
}

const ProgressBadge: React.FC<ProgressBadgeProps> = ({ enrollmentStatus }) => {
  const label =
    enrollmentStatus === EnrollmentStatus.Completed
      ? "Completed"
      : enrollmentStatus === EnrollmentStatus.Enrolled
        ? "In Progress"
        : "Not Started"

  return (
    <BadgeContainer status={enrollmentStatus} data-testid="progress-badge">
      <Typography variant="body3">{label}</Typography>
      {enrollmentStatus === EnrollmentStatus.Completed && (
        <RiCheckLine size="16px" aria-hidden="true" />
      )}
    </BadgeContainer>
  )
}

export { ProgressBadge }
export type { ProgressBadgeProps }
