import React from "react"
import { styled } from "ol-components"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { ReceiptCard } from "./ReceiptCard"
import { formatMoney } from "./receiptUtils"

const SummaryCard = styled(ReceiptCard)(({ theme }) => ({
  gap: "20px",
  [theme.breakpoints.down("sm")]: {
    gap: "12px",
  },
}))

/** The heading and the total share a size; only the section headings are red. */
const Heading = styled.h2(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: theme.typography.subtitle1,
}))

const Rows = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const Row = styled.div({
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  justifyContent: "space-between",
})

const RowLabel = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const RowValue = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  textAlign: "right",
  whiteSpace: "nowrap",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const DiscountValue = styled(RowValue)(({ theme }) => ({
  color: theme.custom.colors.green,
}))

const TotalRow = styled(Row)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  paddingTop: "24px",
  [theme.breakpoints.down("sm")]: theme.typography.subtitle1,
}))

/** `line.discount` is per unit, hence the multiply. */
const getTotalDiscount = (order: Order): number =>
  order.lines.reduce(
    (total, line) => total + Number(line.discount) * line.quantity,
    0,
  )

const getTotalQuantity = (order: Order): number =>
  order.lines.reduce((total, line) => total + line.quantity, 0)

/**
 * Per-item prices, discount and quantity totals, and the amount paid. The
 * design's "Tax" and "Total Before Tax" rows are omitted — the payload has no tax
 * data, so "Total Before Tax" would just restate the total.
 */
const ReceiptOrderSummary: React.FC<{ order: Order; className?: string }> = ({
  order,
  className,
}) => {
  const totalDiscount = getTotalDiscount(order)
  const totalQuantity = getTotalQuantity(order)

  return (
    <SummaryCard className={className}>
      <Heading>Order Summary</Heading>
      <Rows>
        {order.lines.map((line, index) => (
          // Receipt lines carry no id, and the same product can legitimately
          // appear twice, so position is the only stable key available.
          // eslint-disable-next-line react/no-array-index-key
          <Row key={`${line.readable_id}-${index}`}>
            <RowLabel>{line.content_title}</RowLabel>
            <RowValue>{formatMoney(line.price)}</RowValue>
          </Row>
        ))}
        {totalDiscount > 0 ? (
          <Row>
            <RowLabel>Discount</RowLabel>
            <DiscountValue>{`- ${formatMoney(totalDiscount)}`}</DiscountValue>
          </Row>
        ) : null}
        <Row>
          <RowLabel>Quantity</RowLabel>
          <RowValue>{`x ${totalQuantity}`}</RowValue>
        </Row>
      </Rows>
      <TotalRow>
        <span>Total:</span>
        <span>{formatMoney(order.total_price_paid)}</span>
      </TotalRow>
    </SummaryCard>
  )
}

export { ReceiptOrderSummary, getTotalDiscount, getTotalQuantity }
