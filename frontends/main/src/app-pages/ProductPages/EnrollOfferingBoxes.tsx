import React from "react"
import { Alert } from "@mitodl/smoot-design"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import CertificateTrackCard from "./CertificateTrackCard"
import AppliedSavingsCard from "./AppliedSavingsCard"
import LearnForFreeCard from "./LearnForFreeCard"
import EnrolledLink from "./EnrolledLink"
import {
  EnrollButton,
  OfferingCell,
  OfferingHeadingRow,
  FullRowCell,
  FinancialAidIndicator,
} from "./EnrollAreaParts"
import type {
  AppliedSavings,
  EnrollAreaState,
  FinancialAid,
  Offering,
} from "./enrollTypes"

type EnrollOfferingBoxesProps = {
  /** Actionable offering — drives which boxes render and the "both" layout. */
  offering: Offering
  state: EnrollAreaState
  isStatusLoading: boolean
  isPending: boolean
  isError: boolean
  /** Top-right plain price for the certificate card. */
  price: React.ReactNode
  /** Render that price at the title's size, for one too wide to sit beside the title at h4. */
  compactPrice?: boolean
  /** Full-width price presentation; suppresses `price` (program savings only). */
  priceBlock?: React.ReactNode
  financialAid: FinancialAid | null
  /** The learner's own price quote; replaces the certificate card. */
  breakdown?: AppliedSavings | null
  /**
   * Heading over the paid box in the paid-only layout, which has none by
   * default. The side-by-side layout is headed "Choose Your Path" regardless.
   */
  paidHeading?: string
  /** A line beneath the heading row, naming why the paid price is reduced. */
  paidNote?: React.ReactNode
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
 * pass data; this component owns the box structure and button conventions, and
 * knows nothing about why a price is what it is.
 */
const EnrollOfferingBoxes: React.FC<EnrollOfferingBoxesProps> = ({
  offering,
  state,
  isStatusLoading,
  isPending,
  isError,
  price,
  compactPrice,
  priceBlock,
  financialAid,
  breakdown,
  paidHeading,
  paidNote,
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
  const sideBySide = offering === "both"

  // The certificate card carries the aid indicator in its own header. The
  // savings card that replaces it has no header, so the indicator moves up to
  // the heading row. It cannot be pending here: a breakdown only exists once
  // the same lookup has resolved.
  const headingAside =
    breakdown && financialAid ? (
      <FinancialAidIndicator financialAid={financialAid} />
    ) : null

  const renderPaidBox = () => {
    if (!paidAction) return null
    // Every layout but the ordinary paid-only card carries its button inside the
    // box; that one alone puts it below, at the larger size a lone action takes.
    const buttonInBox = sideBySide || !!breakdown
    const button = (
      <EnrollButton
        action={paidAction}
        size={buttonInBox ? "medium" : "large"}
        loading={isStatusLoading}
        pending={isPending}
        fullWidth
      />
    )
    return (
      <OfferingCell data-card="cert">
        {sideBySide ? null : (
          // The side-by-side layout's heading is a grid child of its own.
          <OfferingHeadingRow
            label={paidHeading}
            aside={headingAside}
            note={paidNote}
          />
        )}
        {breakdown ? (
          <AppliedSavingsCard
            breakdown={breakdown}
            productNoun={productNoun}
            fill={sideBySide}
            action={button}
          />
        ) : (
          <CertificateTrackCard
            price={price}
            compactPrice={compactPrice}
            priceBlock={priceBlock}
            financialAid={financialAid}
            productNoun={productNoun}
            // fill: match the free card's height in the side-by-side layout and
            // bottom-align the button.
            fill={sideBySide}
            action={sideBySide ? button : undefined}
          />
        )}
        {buttonInBox ? null : button}
      </OfferingCell>
    )
  }

  const renderFreeBox = () => {
    if (!freeAction) return null

    if (sideBySide) {
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
      {sideBySide && (
        <OfferingHeadingRow
          data-choose-path
          label="Choose Your Path"
          aside={headingAside}
          note={paidNote}
        />
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
