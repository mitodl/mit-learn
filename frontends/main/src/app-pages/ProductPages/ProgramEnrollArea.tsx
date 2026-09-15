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

  const { price, showsRange, savings, financialAid, breakdown } =
    useProgramCertificatePrice(program)

  // A credit is earned by buying one of the program's own courses and is worded
  // throughout as an upgrade to the full program, which a page presenting that
  // program as a single course cannot say. Every other discount — financial aid
  // above all — applies just as much here as on the program page, and shows.
  const appliedSavings =
    displayAsCourse && breakdown?.kind === "credit" ? null : breakdown

  const { state, offering, isStatusLoading, isPending, isError } =
    useProgramEnrollment(program, {
      tracking: { placement: "infobox" },
      displayAsCourse,
      // Only the credit relabels the action; aid leaves the offering's own
      // wording alone.
      upgradeLabel: appliedSavings?.kind === "credit",
      onRequireSignup: setAnchor,
    })

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
      compactPrice={showsRange}
      priceBlock={priceBlock}
      financialAid={financialAid}
      breakdown={appliedSavings}
      productNoun={displayAsCourse ? "course" : "program"}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramEnrollArea
