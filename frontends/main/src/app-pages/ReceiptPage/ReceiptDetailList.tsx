import React from "react"
import { styled } from "ol-components"

/** A label/value pair. A nullish `value` means the row is dropped. */
type ReceiptDetail = {
  label: string
  value: React.ReactNode
}

const Rows = styled.dl({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  width: "100%",
  margin: 0,
})

/** `dl > div` wrapping a dt/dd pair is the standard grouping form. */
const Row = styled.div({
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
})

/**
 * Fixed-width label column, so values line up down the card without needing a
 * grid. It narrows on mobile to leave the value room to wrap rather than truncate.
 */
const Label = styled.dt(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightBold,
  flexShrink: 0,
  width: "200px",
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
    fontWeight: theme.typography.fontWeightBold,
    width: "104px",
  },
}))

const Value = styled.dd(({ theme }) => ({
  ...theme.typography.body2,
  flex: "1 0 0",
  minWidth: 0,
  margin: 0,
  wordBreak: "break-word",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

/**
 * Drop rows the API did not supply, so callers can tell whether a section has any
 * content left and skip rendering it along with its heading. MITx Online leaves
 * optional receipt fields unset rather than blank, and an order with no payment
 * transaction has every payment and address field null.
 */
const populatedRows = (rows: ReceiptDetail[]): ReceiptDetail[] =>
  rows.filter(
    ({ value }) => value !== null && value !== undefined && value !== "",
  )

/**
 * The label/value rows inside a receipt card. Renders nothing when every row was
 * filtered out; see {@link populatedRows}.
 */
const ReceiptDetailList: React.FC<{
  rows: ReceiptDetail[]
  className?: string
}> = ({ rows, className }) => (
  <Rows className={className}>
    {populatedRows(rows).map(({ label, value }) => (
      <Row key={label}>
        <Label>{label}</Label>
        <Value>{value}</Value>
      </Row>
    ))}
  </Rows>
)

export { ReceiptDetailList, populatedRows }
export type { ReceiptDetail }
