import React from "react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useProgramEnrollment } from "./useProgramEnrollment"
import HeaderEnrollButton from "./HeaderEnrollButton"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"

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

  const { state, isStatusLoading, isPending, error } = useProgramEnrollment(
    program,
    {
      tracking: { placement: "header" },
      displayAsCourse,
      onRequireSignup: setAnchor,
    },
  )
  const { price } = useProgramCertificatePrice(program)

  return (
    <HeaderEnrollButton
      state={state}
      price={price}
      isStatusLoading={isStatusLoading}
      isPending={isPending}
      error={error}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramHeaderEnrollButton
