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
  OfferingHeading,
  FullRowCell,
  FinancialAidLink,
  HeadingRow,
  HeadingNote,
} from "./EnrollAreaParts"
import type {
  AppliedSavings,
  EnrollAreaState,
  FinancialAid,
  Offering,
} from "./enrollTypes"

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
  /** The learner's own price quote; replaces the certificate card. Programs only. */
  breakdown?: AppliedSavings | null
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
  compactPrice,
  priceBlock,
  financialAid,
  breakdown,
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

  const note = breakdown?.kind === "credit" ? CREDIT_NOTE : null

  /**
   * The heading's contents. With a breakdown the aid indicator sits here rather
   * than in the certificate card, which is not rendered at all; it cannot be
   * pending here, because a breakdown only exists once that same lookup has
   * resolved.
   *
   * `label` is optional because a paid-only breakdown carries no heading unless
   * it is a credit — but the aid indicator still needs this row.
   */
  const headingContents = (label?: string) => (
    <>
      {label ? <OfferingHeading>{label}</OfferingHeading> : null}
      {breakdown && financialAid ? (
        <FinancialAidLink
          data-heading-aside
          href={financialAid.href}
          $approved={financialAid.applied}
        >
          {financialAid.applied
            ? "Financial aid applied"
            : "Apply for financial aid"}
        </FinancialAidLink>
      ) : null}
      {note ? <HeadingNote>{note}</HeadingNote> : null}
    </>
  )

  const renderPaidBox = () => {
    if (!paidAction) return null
    const sideBySide = offering === "both"
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
        {breakdown && !sideBySide ? (
          // The side-by-side layout's heading is a grid child of its own; this
          // layout has no heading at all without a breakdown. Only a credit
          // names itself here — every other discount leaves the row to carry
          // the aid indicator alone.
          <HeadingRow>
            {headingContents(
              breakdown.kind === "credit"
                ? "Continue with full program"
                : undefined,
            )}
          </HeadingRow>
        ) : null}
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
        <HeadingRow data-choose-path>
          {headingContents("Choose Your Path")}
        </HeadingRow>
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
