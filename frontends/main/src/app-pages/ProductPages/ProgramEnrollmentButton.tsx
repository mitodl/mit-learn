import React from "react"
import { styled, LoadingSpinner } from "ol-components"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { useQuery } from "@tanstack/react-query"
import { V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { RiCheckLine } from "@remixicon/react"
import { Button } from "@mitodl/smoot-design"
import EnrollmentDialog from "@/page-components/EnrollmentDialog/EnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"

const WideButton = styled(Button)({
  width: "100%",
})

const EnrolledPlaceholder = styled.div(({ theme }) => ({
  color: theme.custom.colors.white,
  backgroundColor: theme.custom.colors.mitRed,
  ...theme.typography.buttonLarge,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "48px",
  borderRadius: "4px",
  gap: "12px",
  svg: {
    width: "20px",
    height: "20px",
  },
}))

type ProgramEnrollmentButtonProps = {
  program: V2Program
}
const ProgramEnrollmentButton: React.FC<ProgramEnrollmentButtonProps> = ({
  program,
}) => {
  const enrollments = useQuery({
    ...enrollmentQueries.programEnrollmentsList(),
    throwOnError: false,
  })
  const enrolled =
    program && enrollments.data?.some((e) => e.program.id === program.id)
  if (enrollments.isLoading) {
    return (
      <EnrolledPlaceholder>
        <LoadingSpinner size="20px" loading={true} color="inherit" />
      </EnrolledPlaceholder>
    )
  } else if (enrolled) {
    return (
      <EnrolledPlaceholder>
        Enrolled
        <RiCheckLine aria-hidden="true" />
      </EnrolledPlaceholder>
    )
  }
  return (
    <WideButton
      onClick={() => {
        NiceModal.show(EnrollmentDialog, { type: "program", resource: program })
      }}
      variant="primary"
      size="large"
    >
      Enroll for Free
    </WideButton>
  )
}

export default ProgramEnrollmentButton
