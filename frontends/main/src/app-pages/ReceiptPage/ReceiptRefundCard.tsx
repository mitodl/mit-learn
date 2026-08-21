import React, { useId } from "react"
import { styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RefundStatusEnum } from "@mitodl/mitxonline-api-axios/v2"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { ReceiptCard } from "./ReceiptCard"
import { formatMoney, formatReceiptDate } from "./receiptUtils"

type Tone = "darkGray2" | "red" | "silverGrayDark" | "darkGreen"

const RefundCard = styled(ReceiptCard)(({ theme }) => ({
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    gap: "12px",
  },
}))

const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: theme.typography.subtitle1,
}))

const Detail = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
})

const StatusRow = styled.div({
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  justifyContent: "space-between",
})

const StatusLabel = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
}))

/** The one element carrying the state: its wording and its colour. */
const StatusValue = styled.span<{ tone: Tone }>(({ theme, tone }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors[tone],
  textAlign: "right",
}))

const Timestamp = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
}))

const Note = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const Emphasis = styled(Note)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}))

const RequestButton = styled(Button)({
  width: "100%",
})

type RefundState = {
  status: string
  tone: Tone
  /**
   * Dated line under the status, labelled for what the date actually marks.
   * A submitted request says "Requested" rather than the design's "Processed",
   * since at that point nothing has been — pending design review.
   */
  timestamp?: { label: string; value?: string | null }
  notes?: { text: string; emphasis?: boolean }[]
  action?: boolean
}

const getRefundState = (order: Order): RefundState | null => {
  switch (order.refund_status) {
    case RefundStatusEnum.Eligible:
      return {
        status: `Eligible until ${formatReceiptDate(order.refund_deadline)}`,
        tone: "darkGray2",
        action: true,
      }
    case RefundStatusEnum.WindowClosed:
      return {
        status: "Refund window closed",
        tone: "red",
        action: true,
      }
    case RefundStatusEnum.Requested:
      return {
        status: "Refund requested",
        tone: "silverGrayDark",
        timestamp: { label: "Requested", value: order.refund_requested_on },
        notes: [
          { text: "We'll email you when your refund has been processed." },
          {
            text: "Estimated processing time: 3-5 business days.",
            emphasis: true,
          },
        ],
      }
    case RefundStatusEnum.Denied:
      return {
        status: "Refund declined",
        tone: "red",
        timestamp: { label: "Reviewed", value: order.refund_reviewed_on },
        notes: [
          { text: "We're unable to issue a refund for this order." },
          {
            text: "This request did not meet the criteria for a refund after the refund deadline.",
          },
        ],
      }
    case RefundStatusEnum.Completed: {
      // `refund_fulfilled_order` flips an order's state without writing a
      // transaction, so a completed refund does not always name an amount.
      const refund = order.refunds[0]
      return {
        status: "Refund completed",
        tone: "darkGreen",
        timestamp: { label: "Processed", value: refund?.date },
        notes: [
          {
            text:
              refund?.amount === undefined
                ? "Your refund has been issued to the original payment method."
                : `Your refund of ${formatMoney(refund.amount)} has been issued to the original payment method.`,
          },
          {
            text: "May take a few business days to appear on your statement.",
            emphasis: true,
          },
        ],
      }
    }
    // `ineligible` covers orders that were never refundable — unfulfilled ones
    // and B2B contract orders. There is nothing to tell the learner, so the
    // card is left out entirely.
    default:
      return null
  }
}

/**
 * Where the order stands in the refund flow, and the way to start one.
 *
 * Every branch is driven by `refund_status`, which MITx Online derives from the
 * order state, the refund window, whether the order is B2B, and any request
 * already made. Re-deriving any of that here would duplicate the rules the API
 * applies when it accepts or rejects a request, and the two would drift.
 */
const ReceiptRefundCard: React.FC<{
  order: Order
  /**
   * Omitted until the request dialog exists. The button is the affordance for
   * it, so there is no point rendering one that leads nowhere.
   */
  onRequestRefund?: () => void
  className?: string
}> = ({ order, onRequestRefund, className }) => {
  const headingId = useId()
  const state = getRefundState(order)

  if (!state) return null

  const { status, tone, timestamp, notes, action } = state

  return (
    <RefundCard className={className} as="section" aria-labelledby={headingId}>
      <Heading id={headingId}>Refund</Heading>
      <Detail>
        <StatusRow>
          <StatusLabel>Refund Status</StatusLabel>
          <StatusValue tone={tone}>{status}</StatusValue>
        </StatusRow>
        {timestamp?.value ? (
          <Timestamp>
            {`${timestamp.label} ${formatReceiptDate(timestamp.value)}`}
          </Timestamp>
        ) : null}
        {notes?.map(({ text, emphasis }) =>
          emphasis ? (
            <Emphasis key={text}>{text}</Emphasis>
          ) : (
            <Note key={text}>{text}</Note>
          ),
        )}
      </Detail>
      {action && onRequestRefund ? (
        <RequestButton
          variant="secondary"
          size="large"
          onClick={onRequestRefund}
        >
          Request Refund
        </RequestButton>
      ) : null}
    </RefundCard>
  )
}

export { ReceiptRefundCard, getRefundState }
