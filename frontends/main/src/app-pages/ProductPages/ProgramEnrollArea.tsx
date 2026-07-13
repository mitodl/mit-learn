import React from "react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useProgramEnrollment } from "./useProgramEnrollment"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"
import ProgramSavingsBlock from "./ProgramSavingsBlock"
import EnrollOfferingBoxes from "./EnrollOfferingBoxes"

type ProgramEnrollAreaProps = {
  program: V2ProgramDetail
  displayAsCourse?: boolean
}

const ProgramEnrollArea: React.FC<ProgramEnrollAreaProps> = ({
  program,
  displayAsCourse,
}) => {
  const [anchor, setAnchor] = React.useState<null | HTMLButtonElement>(null)

  const { state, offering, isStatusLoading, isPending, isError } =
    useProgramEnrollment(program, {
      tracking: { placement: "infobox" },
      displayAsCourse,
      onRequireSignup: setAnchor,
    })

  const { price, savings, financialAid } = useProgramCertificatePrice(program)
  // Savings framing is full-program-page presentation only; program-as-course
  // shows the plain price even when a list price is set.
  const priceBlock =
    !displayAsCourse && savings ? <ProgramSavingsBlock {...savings} /> : null

  return (
    <EnrollOfferingBoxes
      offering={offering}
      state={state}
      isStatusLoading={isStatusLoading}
      isPending={isPending}
      isError={isError}
      price={price}
      priceBlock={priceBlock}
      financialAid={financialAid}
      productNoun={displayAsCourse ? "course" : "program"}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramEnrollArea
