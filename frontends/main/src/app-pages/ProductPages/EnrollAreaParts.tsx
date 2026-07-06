import React from "react"
import { LoadingSpinner } from "ol-components"
import { Button, styled, type ButtonProps } from "@mitodl/smoot-design"
import { type EnrollAction } from "./enrollTypes"

export const ChooseYourPath = styled.div(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

const ButtonWrapper = styled.span<{ $fullWidth?: boolean }>(({ $fullWidth }) =>
  $fullWidth
    ? { display: "block", width: "100%", "> button": { width: "100%" } }
    : { display: "inline-block" },
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

/**
 * The page-header enroll button uses the `bordered` variant but with darkGray2
 * text (matching production), not the variant's default silverGrayDark. Disabled
 * buttons keep the variant default. `display: contents` adds no layout box.
 */
export const HeaderButtonSlot = styled.div(({ theme }) => ({
  display: "contents",
  "& button:not(:disabled), & a": {
    color: theme.custom.colors.darkGray2,
  },
}))

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
