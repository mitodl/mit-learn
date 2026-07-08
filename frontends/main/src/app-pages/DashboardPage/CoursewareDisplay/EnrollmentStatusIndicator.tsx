import React from "react"
import { styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { EnrollmentStatus } from "./helpers"
import {
  RiCheckboxBlankCircleFill,
  RiCheckboxCircleFill,
} from "@remixicon/react"

const CompleteIcon = styled(RiCheckboxCircleFill)(({ theme }) => ({
  color: theme.custom.colors.red,
  width: "16px",
  height: "16px",
}))

const InProgressIcon = styled(RiCheckboxBlankCircleFill)(({ theme }) => ({
  color: theme.custom.colors.red,
  width: "16px",
  height: "16px",
}))

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
        <CompleteIcon aria-hidden />
        <VisuallyHidden>Completed</VisuallyHidden>
      </span>
    )
  }
  if (!showNotComplete) return

  if (status === EnrollmentStatus.Enrolled) {
    return (
      <Ring data-testid="enrollment-status">
        <InProgressIcon aria-hidden />
        <VisuallyHidden>Enrolled</VisuallyHidden>
      </Ring>
    )
  }

  return (
    <Ring data-testid="enrollment-status">
      <VisuallyHidden>Not Enrolled</VisuallyHidden>
    </Ring>
  )
}

export { EnrollmentStatusIndicator }
export type { EnrollmentStatusIndicatorProps }
