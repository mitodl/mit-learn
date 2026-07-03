import React from "react"
import { Button } from "@mitodl/smoot-design"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { EnrollButton, HeaderButtonSlot } from "./EnrollAreaParts"
import { useProgramEnrollment } from "./useProgramEnrollment"
import EnrolledLink from "./EnrolledLink"

export type ProgramHeaderEnrollButtonProps = {
  program: V2ProgramDetail
  displayAsCourse?: boolean
}

/**
 * Page-header enroll CTA for program product pages. Mirrors the InfoBox's
 * recommended action: the paid/first option in the Both case, "Enrolled", or
 * a disabled "Enroll" placeholder when nothing is enrollable.
 */
const ProgramHeaderEnrollButton: React.FC<ProgramHeaderEnrollButtonProps> = ({
  program,
  displayAsCourse,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)

  const { state, isStatusLoading, isPending } = useProgramEnrollment(program, {
    tracking: { placement: "header" },
    displayAsCourse,
    onRequireSignup: (el) => setAnchor(el),
  })

  if (state.status === "enrolled") {
    return (
      <HeaderButtonSlot>
        <EnrolledLink variant="bordered" href={state.href} />
      </HeaderButtonSlot>
    )
  }

  if (state.status === "options") {
    return (
      <HeaderButtonSlot>
        <EnrollButton
          action={state.options[0]}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          variant="bordered"
          announceStatus={false}
        />
        <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
      </HeaderButtonSlot>
    )
  }

  // status === "none"
  return (
    <HeaderButtonSlot>
      <Button variant="bordered" size="large" disabled>
        Enroll
      </Button>
    </HeaderButtonSlot>
  )
}

export default ProgramHeaderEnrollButton
