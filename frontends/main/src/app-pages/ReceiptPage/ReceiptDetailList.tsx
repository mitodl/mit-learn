import React from "react"
import { Typography, styled } from "ol-components"

/**
 * A label/value pair. `value` is nullish when the API did not supply the field,
 * in which case the row is dropped rather than rendered empty — see
 * {@link ReceiptDetailList}.
 */
type ReceiptDetail = {
  label: string
  value: React.ReactNode
}

/**
 * A group of rows rendered contiguously. Groups are separated by vertical space,
 * mirroring the blank spacer rows in the design.
 */
type ReceiptDetailGroup = ReceiptDetail[]

const LABEL_COLUMN_WIDTH = "200px"

const GroupStack = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "34px",
})

/**
 * Each group is its own grid. The label column is a fixed width, so groups line
 * up with each other without needing to share one grid container (which would
 * mean putting non-`dt`/`dd` spacers inside a `dl`).
 */
const DetailList = styled.dl(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: `${LABEL_COLUMN_WIDTH} minmax(0, 1fr)`,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
}))

/**
 * The bottom border is drawn on both cells so the rule spans the full row.
 */
const cell = {
  display: "flex",
  alignItems: "center",
  margin: 0,
  padding: "8px 16px 8px 0",
  minHeight: "34px",
  boxSizing: "border-box" as const,
}

const DetailLabel = styled.dt(({ theme }) => ({
  ...cell,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    borderBottom: "none",
    paddingBottom: 0,
    minHeight: "unset",
  },
}))

const DetailValue = styled.dd(({ theme }) => ({
  ...cell,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  wordBreak: "break-word",
}))

/**
 * Drop rows the API did not supply, then drop any group left with no rows.
 *
 * MITx Online leaves optional receipt fields unset rather than blank — CEUs is
 * always null today, and orders with no CyberSource transaction (fully
 * discounted, or B2B) come back with every payment and address field null. A
 * labelled empty row reads as missing data, and a whole section of them reads as
 * a broken page, so callers use this to decide whether to render the section at
 * all.
 */
const populatedGroups = (groups: ReceiptDetailGroup[]): ReceiptDetailGroup[] =>
  groups
    .map((group) =>
      group.filter(
        ({ value }) => value !== null && value !== undefined && value !== "",
      ),
    )
    .filter((group) => group.length > 0)

/**
 * The two-column label/value table used by each section of the receipt. Renders
 * nothing when every row was filtered out; see {@link populatedGroups}.
 */
const ReceiptDetailList: React.FC<{
  groups: ReceiptDetailGroup[]
  className?: string
}> = ({ groups, className }) => {
  const populated = populatedGroups(groups)

  return (
    <GroupStack className={className}>
      {populated.map((group) => (
        // Groups are positional; the first label is a stable enough identity
        // for a list that is rebuilt wholesale whenever the order changes.
        <DetailList key={group[0].label}>
          {group.map(({ label, value }) => (
            <React.Fragment key={label}>
              <DetailLabel>
                <Typography variant="subtitle2" component="span">
                  {label}
                </Typography>
              </DetailLabel>
              <DetailValue>
                <Typography variant="body2" component="span">
                  {value}
                </Typography>
              </DetailValue>
            </React.Fragment>
          ))}
        </DetailList>
      ))}
    </GroupStack>
  )
}

export { ReceiptDetailList, LABEL_COLUMN_WIDTH, populatedGroups }
export type { ReceiptDetail, ReceiptDetailGroup }
