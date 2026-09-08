import React from "react"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { useProgramEnrollment } from "./useProgramEnrollment"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"
import ProgramSavingsBlock from "./ProgramSavingsBlock"
import EnrollOfferingBoxes from "./EnrollOfferingBoxes"

/**
 * A credit arrives unasked — it is earned by buying one of the program's own
 * courses, not applied for — so the row explains itself here rather than only
 * behind the popover, and "full" is the point of the sentence. Every other
 * discount goes without: the learner either asked for it, as with financial
 * aid, or it is a sale or a personal code that needs no explaining, and in each
 * case the deduction row already names it.
 */
const CREDIT_NOTE = (
  <>
    Your purchase is <strong>applied</strong> to the full program price.
  </>
)

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

  // The credit is the one discount that changes the offering's own words: it
  // relabels the action, heads the paid box, and explains itself beneath the
  // heading. Aid and every other discount leave all three alone. Deciding the
  // three here, together, is what keeps them from drifting apart.
  const credit = appliedSavings?.kind === "credit"

  const { state, offering, isStatusLoading, isPending, error } =
    useProgramEnrollment(program, {
      tracking: { placement: "infobox" },
      displayAsCourse,
      upgradeLabel: credit,
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
      error={error}
      price={price}
      compactPrice={showsRange}
      priceBlock={priceBlock}
      financialAid={financialAid}
      breakdown={appliedSavings}
      paidHeading={credit ? "Continue with full program" : undefined}
      paidNote={credit ? CREDIT_NOTE : undefined}
      productNoun={displayAsCourse ? "course" : "program"}
      anchor={anchor}
      onAnchorClose={() => setAnchor(null)}
    />
  )
}

export default ProgramEnrollArea
