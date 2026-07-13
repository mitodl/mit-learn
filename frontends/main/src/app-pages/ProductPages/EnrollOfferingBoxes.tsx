import React from "react"
import { Alert } from "@mitodl/smoot-design"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import CertificateTrackCard from "./CertificateTrackCard"
import LearnForFreeCard from "./LearnForFreeCard"
import EnrolledLink from "./EnrolledLink"
import {
  EnrollButton,
  OfferingCell,
  ChooseYourPath,
  FullRowCell,
} from "./EnrollAreaParts"
import type { EnrollAreaState, Offering } from "./enrollTypes"

type EnrollOfferingBoxesProps = {
  /** Actionable offering — drives which boxes render and the "both" layout. */
  offering: Offering
  state: EnrollAreaState
  isStatusLoading: boolean
  isPending: boolean
  isError: boolean
  /** Top-right plain price for the certificate card. */
  price: React.ReactNode
  /** Full-width price presentation; suppresses `price` (program savings only). */
  priceBlock?: React.ReactNode
  financialAid: { href: string; applied: boolean } | null
  productNoun: "course" | "program"
  /** Course-only: show the "Certificate deadline passed" note in the free card. */
  certificateDeadlineNote?: boolean
  /** SignupPopover anchor owned by the caller (set via the hook's onRequireSignup). */
  anchor: HTMLButtonElement | null
  onAnchorClose: () => void
}

/**
 * The InfoBox enroll area's offering boxes, shared by the course and program
 * variants: the enrolled collapse, the paid/free cards with their buttons
 * (side-by-side under "Choose Your Path" when both paths exist), the
 * enrollment-failure alert, and the signup popover. Callers own the hooks and
 * pass data; this component owns the box structure and button conventions.
 */
const EnrollOfferingBoxes: React.FC<EnrollOfferingBoxesProps> = ({
  offering,
  state,
  isStatusLoading,
  isPending,
  isError,
  price,
  priceBlock,
  financialAid,
  productNoun,
  certificateDeadlineNote,
  anchor,
  onAnchorClose,
}) => {
  if (state.status === "none") {
    return null
  }

  if (state.status === "enrolled") {
    // Wrap in OfferingCell so the link sits at the top of its grid cell at its
    // natural height. As a bare grid child it would otherwise stretch to match
    // the (taller) metadata column in the tablet side-by-side layout.
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
    // freeOnly (incl. course deadlinePassed / archived): card + button below,
    // wrapped as one grid cell. The lone action is primary (filled).
    return (
      <OfferingCell data-card="free">
        <LearnForFreeCard
          productNoun={productNoun}
          certificateDeadlineNote={certificateDeadlineNote}
        />
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
      <SignupPopover anchorEl={anchor} onClose={onAnchorClose} />
    </>
  )
}

export default EnrollOfferingBoxes
