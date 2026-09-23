import React from "react"
import { LoadingSpinner, linkStyles } from "ol-components"
import { Button, styled, type ButtonProps } from "@mitodl/smoot-design"
import type { EnrollAction, FinancialAid } from "./enrollTypes"

const OfferingHeading = styled.div(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

/**
 * The heading and its aside wrap onto separate lines where they do not share
 * one: the tablet grid gives this row a ~268px cell against the ~346px of the
 * desktop sidebar, and "Continue with full program" beside "Apply for financial
 * aid" only just fits at the wider size.
 */
const HeadingRow = styled.div({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  columnGap: "8px",
  rowGap: "4px",
})

/**
 * Holds the aside at the right edge whether it shares the heading's line or
 * takes one of its own, where `justify-content: space-between` would left-align
 * it once alone.
 */
const HeadingAside = styled.span({ marginLeft: "auto" })

/** Takes a line of its own whatever else in the row wrapped. */
const HeadingNote = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  flexBasis: "100%",
}))

type OfferingHeadingRowProps = {
  /** The heading over an offering box, whatever that box turns out to be. */
  label?: string
  /** Right-aligned beside the heading; the financial-aid indicator. */
  aside?: React.ReactNode
  /** The line beneath the heading, naming why the price below it is reduced. */
  note?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>

/**
 * The row above an offering box. Renders nothing when it has nothing to carry:
 * an empty row would still be a flex item, and the cell's gap would open a
 * blank band above the box.
 */
export const OfferingHeadingRow: React.FC<OfferingHeadingRowProps> = ({
  label,
  aside,
  note,
  ...rest
}) => {
  if (!label && !aside && !note) return null
  return (
    <HeadingRow {...rest}>
      {label ? <OfferingHeading>{label}</OfferingHeading> : null}
      {aside ? <HeadingAside>{aside}</HeadingAside> : null}
      {note ? <HeadingNote>{note}</HeadingNote> : null}
    </HeadingRow>
  )
}

/**
 * `linkStyles`' small "red" link is the body3 scale these rows want, and its red
 * is the call-to-action colour for the unapproved state. The approved state
 * keeps that scale and swaps only the colour, which Link has no variant for:
 * green marks it as a resolved state rather than something to act on, so it also
 * drops the resting underline and takes one on hover instead — it stays a link
 * to the application record, but users have no reason to follow it.
 */
const FinancialAidLink = styled.a<{ $approved?: boolean }>(
  linkStyles({ size: "small", color: "red" }),
  ({ $approved, theme }) =>
    $approved
      ? {
          color: theme.custom.colors.green,
          ":hover": {
            color: theme.custom.colors.green,
            textDecoration: "underline",
          },
        }
      : { textDecoration: "underline" },
)

/**
 * Holds the aid link's row while the approval lookup is in flight, so resolving
 * it does not shift the box it sits in. Sized by the link's own line box, which
 * `linkStyles`' small scale resolves to body3.
 */
const FinancialAidPlaceholder = styled.span(({ theme }) => ({
  display: "block",
  height: theme.typography.body3.lineHeight,
}))

/**
 * The financial-aid indicator for a paid offering box: a link to the form,
 * worded by approval. "Approved" rather than "applied" because it is true
 * whatever the quote did with the tier — won with it, lost it to a cheaper
 * discount, or priced at list from a 0% tier.
 */
export const FinancialAidIndicator: React.FC<{
  financialAid: FinancialAid
}> = ({ financialAid }) =>
  financialAid.pending ? (
    <FinancialAidPlaceholder />
  ) : (
    <FinancialAidLink href={financialAid.href} $approved={financialAid.applied}>
      {financialAid.applied
        ? "Financial aid approved"
        : "Apply for financial aid"}
    </FinancialAidLink>
  )

const ButtonWrapper = styled.span<{ $fullWidth?: boolean }>(
  ({ $fullWidth, theme }) => ({
    ...($fullWidth
      ? { display: "block", width: "100%", "> button": { width: "100%" } }
      : { display: "inline-block" }),
    // Buttons always span the full width on small screens.
    [theme.breakpoints.down("md")]: {
      display: "block",
      width: "100%",
      "> button": { width: "100%" },
    },
  }),
)

/**
 * One offering "box" as a grid cell: the card plus, in single-box scenarios,
 * the enrollment button below it. The 16px gap separates the card from a
 * below-the-card button (no-op in the Both case, where the button is inside
 * the card).
 */
export const OfferingCell = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

/**
 * Grid cell spanning the full row of BoxGrid. For enroll-area children that are
 * not one of the counted offering boxes (e.g. the enrollment error alert):
 * BoxGrid's tablet layout is two-column with auto-flow, so an uncounted child
 * would otherwise land in a half-width column slot. Spanning `1 / -1` is a
 * no-op in the single-column layouts.
 */
export const FullRowCell = styled.div({
  gridColumn: "1 / -1",
})

export type EnrollButtonProps = {
  action: EnrollAction
  size: "medium" | "large"
  loading: boolean
  pending: boolean
  variant?: ButtonProps["variant"]
  announceStatus?: boolean
  fullWidth?: boolean
}

export const EnrollButton: React.FC<EnrollButtonProps> = ({
  action,
  size,
  loading,
  pending,
  variant = "primary",
  announceStatus = true,
  fullWidth = false,
}) => {
  const isBusy = loading || pending
  // While busy the label is hidden behind the spinner, so give the button an
  // accessible name rather than leaving it nameless (WCAG 4.1.2). "Loading" is
  // neutral — we intentionally avoid the action label here, which the
  // spinner-first design exists to hide.
  const busyProps = {
    ...(announceStatus ? { "aria-busy": isBusy } : {}),
    ...(isBusy ? { "aria-label": "Loading" } : {}),
  }
  return (
    <ButtonWrapper data-size={size} $fullWidth={fullWidth}>
      <Button
        variant={variant}
        size={size}
        onClick={action.onClick}
        disabled={isBusy}
        {...busyProps}
        endIcon={
          isBusy ? (
            // Hide the spinner from assistive tech — the button already conveys
            // busy via aria-busy + the "Loading" name, and would otherwise leak
            // a redundant role=progressbar named "Loading". LoadingSpinner does
            // not forward aria-hidden, so wrap it in an element that does.
            <span aria-hidden="true">
              <LoadingSpinner size="16px" loading={true} color="inherit" />
            </span>
          ) : undefined
        }
      >
        {isBusy ? null : action.label}
      </Button>
    </ButtonWrapper>
  )
}
