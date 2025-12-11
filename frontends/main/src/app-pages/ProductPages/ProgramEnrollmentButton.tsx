import React from "react"
import { styled, LoadingSpinner } from "ol-components"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { useQuery } from "@tanstack/react-query"
import { V2Program } from "@mitodl/mitxonline-api-axios/v2"
import { RiCheckLine } from "@remixicon/react"
import { Button } from "@mitodl/smoot-design"
import EnrollmentDialog from "@/page-components/EnrollmentDialog/EnrollmentDialog"
import NiceModal from "@ebay/nice-modal-react"
import { userQueries } from "api/hooks/user"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"

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
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)
  const me = useQuery(userQueries.me())
  const enrollments = useQuery({
    ...enrollmentQueries.programEnrollmentsList(),
    throwOnError: false,
  })
  const enrolled =
    program && enrollments.data?.some((e) => e.program.id === program.id)
  if (enrollments.isLoading || me.isLoading) {
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

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (me.data?.is_authenticated) {
      NiceModal.show(EnrollmentDialog, { type: "program", resource: program })
    } else {
      setAnchor(e.currentTarget)
    }
  }

  return (
    <>
      <WideButton onClick={handleClick} variant="primary" size="large">
        Enroll for Free
      </WideButton>
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default ProgramEnrollmentButton
