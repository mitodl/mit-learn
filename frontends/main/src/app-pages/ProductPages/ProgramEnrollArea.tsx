import React from "react"
import { Alert } from "@mitodl/smoot-design"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { useProgramEnrollment } from "./useProgramEnrollment"
import { useProgramCertificatePrice } from "./useProgramCertificatePrice"
import CertificateTrackCard from "./CertificateTrackCard"
import LearnForFreeCard from "./LearnForFreeCard"
import EnrolledLink from "./EnrolledLink"
import {
  EnrollButton,
  OfferingCell,
  ChooseYourPath,
  FullRowCell,
} from "./EnrollAreaParts"

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
      onRequireSignup: (el) => setAnchor(el),
    })

  const { price, priceBlock, financialAid } = useProgramCertificatePrice(
    program,
    { showSavings: !displayAsCourse },
  )

  const productNoun = displayAsCourse ? "course" : "program"

  if (state.status === "none") {
    return null
  }

  if (state.status === "enrolled") {
    // Wrap in OfferingCell so the link sits at the top of its grid cell at its
    // natural height, matching CourseEnrollArea's enrolled-state layout.
    return (
      <OfferingCell data-card="enrolled">
        <EnrolledLink variant="primary" href={state.href} />
      </OfferingCell>
    )
  }

  // state.status === "options"
  const options = state.options
  const paidAction = options.find((o) => o.kind === "paid")
  const freeAction = options.find((o) => o.kind === "free")

  const renderPaidBox = () => {
    if (!paidAction) return null
    if (offering === "both") {
      // Button inside card. fill: match the free card's height in the
      // side-by-side layout and bottom-align the button.
      return (
        <OfferingCell data-card="cert">
          <CertificateTrackCard
            price={price}
            priceBlock={priceBlock}
            financialAid={financialAid}
            productNoun={productNoun}
            fill
            action={
              <EnrollButton
                action={paidAction}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
                fullWidth
              />
            }
          />
        </OfferingCell>
      )
    }
    // paidOnly: card + button below, wrapped as one grid cell
    return (
      <OfferingCell data-card="cert">
        <CertificateTrackCard
          price={price}
          priceBlock={priceBlock}
          financialAid={financialAid}
          productNoun={productNoun}
        />
        <EnrollButton
          action={paidAction}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          fullWidth
        />
      </OfferingCell>
    )
  }

  const renderFreeBox = () => {
    if (!freeAction) return null

    if (offering === "both") {
      // Button inside card. Secondary (outline) only here, to distinguish it
      // from the primary Certificate Track button alongside it.
      return (
        <OfferingCell data-card="free">
          <LearnForFreeCard
            productNoun={productNoun}
            fill
            action={
              <EnrollButton
                action={freeAction}
                size="medium"
                loading={isStatusLoading}
                pending={isPending}
                variant="secondary"
                fullWidth
              />
            }
          />
        </OfferingCell>
      )
    }
    // freeOnly: card + button below, wrapped as one grid cell.
    return (
      <OfferingCell data-card="free">
        <LearnForFreeCard productNoun={productNoun} />
        <EnrollButton
          action={freeAction}
          size="large"
          loading={isStatusLoading}
          pending={isPending}
          fullWidth
        />
      </OfferingCell>
    )
  }

  return (
    <>
      {offering === "both" && (
        <ChooseYourPath data-choose-path>Choose Your Path</ChooseYourPath>
      )}
      {renderPaidBox()}
      {renderFreeBox()}
      {isError && (
        <FullRowCell>
          <Alert severity="error">
            There was a problem processing your enrollment. Please try again.
          </Alert>
        </FullRowCell>
      )}
      <SignupPopover anchorEl={anchor} onClose={() => setAnchor(null)} />
    </>
  )
}

export default ProgramEnrollArea
