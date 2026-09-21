import React from "react"
import { styled, ActionButton, VisuallyHidden } from "@mitodl/smoot-design"
import { Popover } from "ol-components"
import { RiInformation2Line } from "@remixicon/react"
import { CardSurface } from "./TrackCard"
import type { AppliedSavings } from "./enrollTypes"

const INFO_LABEL = "Applied savings"
/** The `(i)` button's name; the row beside it already reads INFO_LABEL. */
const INFO_BUTTON_LABEL = "About applied savings"

const INFO_BODY: Record<AppliedSavings["kind"], string | null> = {
  credit:
    "One previous purchase from this program can be credited toward the full program's price.",
  aid: "Based on your approved financial aid.",
  // A sale or a personal code explains itself: the row already names an amount
  // and there is no rule behind it the learner could act on.
  other: null,
}

const Rows = styled.dl({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
  margin: 0,
})

/**
 * One label/value pair. The amount is set larger than its term, so the two are
 * aligned at the top and the amount's extra height hangs below — bottom or
 * baseline alignment instead lifts the amount above its term.
 */
const Row = styled.div({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "8px",
  width: "100%",
})

const TotalRow = styled(Row)(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  paddingTop: "16px",
}))

const Label = styled.dt(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
}))

/** The sum's term, a step up the scale from the rows it totals. */
const TotalLabel = styled(Label)(({ theme }) => ({
  ...theme.typography.subtitle1,
}))

/**
 * The deduction's term, which carries the discount's identity on a second line.
 * Both lines live in the `dt` so a screen reader reads them as one term paired
 * with one amount.
 */
const SavingsLabel = styled.dt({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
})

/** Lighter than the two labels it sits between. */
const SavingsLabelText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const SubLabel = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

/**
 * Centers the icon on the label's line box. Works because inline-flex is
 * inline-level, so verticalAlign applies to the container itself.
 */
const InfoButtonContainer = styled.span(({ theme }) => ({
  marginLeft: "8px",
  display: "inline-flex",
  verticalAlign: "middle",
  height: theme.typography.body2.lineHeight,
  alignItems: "center",
  "> button": {
    color: theme.custom.colors.silverGrayDark,
  },
}))

const InfoPopover = styled(Popover)({
  width: "300px",
  maxWidth: "100vw",
})

const InfoBody = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

/**
 * The rule behind the deduction. A popover rather than a dialog: it explains
 * one row, and the price it explains stays on screen beside it.
 *
 * Opening is bound to click, which covers pointer, touch and keyboard alike —
 * hover would leave touch users with nothing to reach it by. Click-away and
 * Escape close it, and focus returns to the icon.
 *
 * It opens upwards because the rows below it are the total this popover exists
 * to explain; the default placement covers them at every width. Popper still
 * flips it down when there is no room above.
 */
const InfoPopoverButton: React.FC<{ body: string }> = ({ body }) => {
  const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null)
  return (
    <InfoButtonContainer>
      <ActionButton
        size="small"
        variant="text"
        aria-label={INFO_BUTTON_LABEL}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <RiInformation2Line aria-hidden="true" />
      </ActionButton>
      <InfoPopover
        aria-label={INFO_LABEL}
        anchorEl={anchor}
        placement="top-end"
        open={!!anchor}
        onClose={() => setAnchor(null)}
      >
        <InfoBody>{body}</InfoBody>
      </InfoPopover>
    </InfoButtonContainer>
  )
}

const Amount = styled.dd(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  margin: 0,
}))

/**
 * Alone among the amounts this one drops to the foot of its term, so it reads
 * against the source line rather than against the words "Applied savings" — the
 * source is what the deduction is being taken for.
 */
const Deduction = styled(Amount)(({ theme }) => ({
  color: theme.custom.colors.green,
  alignSelf: "flex-end",
}))

const Total = styled(Amount)(({ theme }) => ({
  ...theme.typography.h4,
}))

type AppliedSavingsCardProps = {
  breakdown: AppliedSavings
  /** Names the first row. A program presented as a course is priced as one. */
  productNoun: "course" | "program"
  action?: React.ReactNode
  fill?: boolean
}

const FULL_PRICE_LABEL: Record<AppliedSavingsCardProps["productNoun"], string> =
  {
    course: "Course price",
    program: "Program price",
  }

/**
 * The paid offering box for a learner whose quote carries a discount: the
 * program's price, what comes off it, and what checkout charges today. Replaces
 * the Certificate Track card rather than decorating it — a learner with a real
 * number has no use for the advertised one, or for the feature bullets beside
 * it.
 */
const AppliedSavingsCard: React.FC<AppliedSavingsCardProps> = ({
  breakdown,
  productNoun,
  action,
  fill,
}) => {
  const { kind, sourceTitle } = breakdown
  // Only aid names itself; a credit is named by the purchase it spends, and
  // nothing else in the union carries a source to name.
  const subLabel = sourceTitle ?? (kind === "aid" ? "Financial aid" : null)
  const infoBody = INFO_BODY[kind]

  return (
    <CardSurface variant="shaded" fill={fill}>
      <Rows>
        <Row>
          <Label>{FULL_PRICE_LABEL[productNoun]}</Label>
          <Amount>{breakdown.fullPrice}</Amount>
        </Row>
        <Row>
          <SavingsLabel>
            <SavingsLabelText>
              {INFO_LABEL}
              {infoBody ? <InfoPopoverButton body={infoBody} /> : null}
            </SavingsLabelText>
            {subLabel ? <SubLabel>{subLabel}</SubLabel> : null}
          </SavingsLabel>
          <Deduction>
            {/* The sign carries the meaning, so it is text rather than colour
                alone. U+2212, not a hyphen: it is cut to the width and height
                of the digits beside it, where a hyphen reads as a stray mark
                against a number this large. Screen readers do not announce
                either one reliably, hence the visually hidden word. */}
            <VisuallyHidden>minus </VisuallyHidden>
            <span aria-hidden="true">&minus; </span>
            {breakdown.amountOff}
          </Deduction>
        </Row>
        <TotalRow>
          <TotalLabel>Today&rsquo;s price</TotalLabel>
          <Total>{breakdown.todaysPrice}</Total>
        </TotalRow>
      </Rows>
      {action}
    </CardSurface>
  )
}

export default AppliedSavingsCard
