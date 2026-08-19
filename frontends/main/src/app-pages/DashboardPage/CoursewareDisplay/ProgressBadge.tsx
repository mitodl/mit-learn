import React from "react"
import { styled, Typography } from "ol-components"
import { EnrollmentStatus } from "./helpers"
import { getRunTimeState } from "./courseDateUtils"
import { RiCheckLine } from "@remixicon/react"

type BadgeVariant = "completed" | "in-progress" | "ended" | "not-started"

const BADGE_LABELS: Record<BadgeVariant, string> = {
  completed: "Completed",
  "in-progress": "In Progress",
  ended: "Ended",
  "not-started": "Not Started",
}

const BadgeContainer = styled("div")<{
  variant: BadgeVariant
}>(({ theme, variant }) => {
  let backgroundColor = theme.custom.colors.lightGray1
  let color = theme.custom.colors.silverGrayDark

  if (variant === "completed") {
    backgroundColor = `${theme.custom.colors.black}0A`
  } else if (variant === "in-progress") {
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

/**
 * The badge describes the run the card is displaying, so an enrolled learner
 * whose run has not started yet reads as "Not Started" and one whose run is
 * over reads as "Ended" — never "In Progress", which the dates contradict.
 * Callers without a single run to point at (programs) simply omit the dates.
 */
const getBadgeVariant = (
  enrollmentStatus: EnrollmentStatus,
  startDate?: string | null,
  endDate?: string | null,
): BadgeVariant => {
  if (enrollmentStatus === EnrollmentStatus.Completed) return "completed"
  if (enrollmentStatus !== EnrollmentStatus.Enrolled) return "not-started"

  const timeState = getRunTimeState(startDate, endDate)
  if (timeState === "upcoming") return "not-started"
  if (timeState === "ended") return "ended"
  return "in-progress"
}

interface ProgressBadgeProps {
  enrollmentStatus: EnrollmentStatus
  startDate?: string | null
  endDate?: string | null
}

const ProgressBadge: React.FC<ProgressBadgeProps> = ({
  enrollmentStatus,
  startDate,
  endDate,
}) => {
  const variant = getBadgeVariant(enrollmentStatus, startDate, endDate)

  return (
    <BadgeContainer variant={variant} data-testid="progress-badge">
      <Typography variant="body3">{BADGE_LABELS[variant]}</Typography>
      {variant === "completed" && (
        <RiCheckLine size="16px" aria-hidden="true" />
      )}
    </BadgeContainer>
  )
}

export { ProgressBadge }
export type { ProgressBadgeProps }
