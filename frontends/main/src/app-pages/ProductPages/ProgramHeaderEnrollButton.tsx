import React from "react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useProgramEnrollment } from "./useProgramEnrollment"
import HeaderEnrollButton from "./HeaderEnrollButton"

export type ProgramHeaderEnrollButtonProps = {
  program: V2ProgramDetail
  displayAsCourse?: boolean
}

/** Page-header enroll CTA for program product pages. */
const ProgramHeaderEnrollButton: React.FC<ProgramHeaderEnrollButtonProps> = ({
  program,
  displayAsCourse,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)

  const { state, isStatusLoading, isPending, isError } = useProgramEnrollment(
    program,
    {
      tracking: { placement: "header" },
      displayAsCourse,
      onRequireSignup: setAnchor,
    },
  )

  return (
    <HeaderEnrollButton
      state={state}
      isStatusLoading={isStatusLoading}
      isPending={isPending}
      isError={isError}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramHeaderEnrollButton
