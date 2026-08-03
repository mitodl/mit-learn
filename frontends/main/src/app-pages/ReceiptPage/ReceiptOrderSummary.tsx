import React from "react"
import { Typography, styled } from "ol-components"
import type { Order } from "@mitodl/mitxonline-api-axios/v2"
import { formatMoney } from "./receiptUtils"

const SummaryCard = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "16px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow:
    "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
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
})

const RowLabel = styled(Typography)({
  flex: "1 0 0",
  minWidth: 0,
})

const RowValue = styled(Typography)({
  flexShrink: 0,
  textAlign: "right",
})

const DiscountValue = styled(RowValue)(({ theme }) => ({
  color: theme.custom.colors.green,
}))

const Rule = styled.hr(({ theme }) => ({
  border: "none",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: 0,
}))

const TotalRow = styled.div({
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
})

/**
 * Total discount applied across the order.
 *
 * `TransactionLine.discount` is the per-unit discount MITx Online computed for
 * the line (`product.price - discounted_price`), so it is multiplied by quantity
 * to get what the learner actually saved.
 */
const getTotalDiscount = (order: Order): number =>
  order.lines.reduce(
    (total, line) => total + Number(line.discount) * line.quantity,
    0,
  )

const getTotalQuantity = (order: Order): number =>
  order.lines.reduce((total, line) => total + line.quantity, 0)

/**
 * The right-hand order summary: per-item prices, the discount and quantity
 * totals, and the amount paid.
 *
 * The design also shows "Total Before Tax" and a "Tax (10%)" line. MITx Online's
 * receipt payload carries no tax figures at all (`total_price_paid` is the only
 * total), so those rows are omitted rather than shown with an invented value.
 */
const ReceiptOrderSummary: React.FC<{ order: Order; className?: string }> = ({
  order,
  className,
}) => {
  const totalDiscount = getTotalDiscount(order)
  const totalQuantity = getTotalQuantity(order)

  return (
    <SummaryCard className={className}>
      <Typography variant="h5" component="h2">
        Order Summary
      </Typography>
      <Rows>
        {order.lines.map((line, index) => (
          // Receipt lines carry no id, and the same product can legitimately
          // appear twice, so position is the only stable key available.
          // eslint-disable-next-line react/no-array-index-key
          <Row key={`${line.readable_id}-${index}`}>
            <RowLabel variant="body2">{line.content_title}</RowLabel>
            <RowValue variant="body2">{formatMoney(line.price)}</RowValue>
          </Row>
        ))}
        {totalDiscount > 0 ? (
          <Row>
            <RowLabel variant="body2">Discount</RowLabel>
            <DiscountValue variant="body2">
              {`- ${formatMoney(totalDiscount)}`}
            </DiscountValue>
          </Row>
        ) : null}
        <Row>
          <RowLabel variant="body2">Quantity</RowLabel>
          <RowValue variant="body2">{`x ${totalQuantity}`}</RowValue>
        </Row>
        <Rule />
        <TotalRow>
          <Typography variant="h5" component="span">
            Total:
          </Typography>
          <Typography variant="h5" component="span">
            {formatMoney(order.total_price_paid)}
          </Typography>
        </TotalRow>
      </Rows>
    </SummaryCard>
  )
}

export { ReceiptOrderSummary, getTotalDiscount, getTotalQuantity }
