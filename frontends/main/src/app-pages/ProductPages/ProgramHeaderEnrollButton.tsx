import React from "react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useProgramEnrollment } from "./useProgramEnrollment"
import HeaderEnrollButton from "./HeaderEnrollButton"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"
import { programAppliedSavings } from "./appliedSavings"

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

  // Same price and label as the InfoBox's paid action (ProgramEnrollArea).
  const { price, breakdown } = useProgramCertificatePrice(program)
  const appliedSavings = programAppliedSavings(breakdown, displayAsCourse)

  const { state, isStatusLoading, isPending, error } = useProgramEnrollment(
    program,
    {
      tracking: { placement: "header" },
      displayAsCourse,
      upgradeLabel: appliedSavings?.kind === "credit",
      onRequireSignup: setAnchor,
    },
  )

  return (
    <HeaderEnrollButton
      state={state}
      price={appliedSavings?.todaysPrice ?? price}
      isStatusLoading={isStatusLoading}
      isPending={isPending}
      error={error}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramHeaderEnrollButton
