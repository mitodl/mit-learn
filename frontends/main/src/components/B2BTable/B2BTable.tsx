"use client"

import { styled, Typography } from "ol-components"

/**
 * The table primitives of the B2B org-manager dashboard, shared by the contract
 * admin page and the org analytics dashboard so the two read as one product.
 *
 * These are ARIA-role tables built from `div`s rather than `<table>`: below the
 * `md` breakpoint the header row is hidden and each row reflows into a stack of
 * label/value pairs (see `MobileLabel`), which a real `<table>` cannot do
 * without losing its own semantics. Callers supply `role="table"`,
 * `role="row"`, `role="columnheader"` and `role="cell"` — the roles are not
 * baked in here because the same visual row is sometimes a header and
 * sometimes not.
 *
 * `$flex` sets each column's share of the row on desktop; every cell in a
 * column must be given the same value, so callers keep a `COLUMN_FLEX` map
 * rather than repeating numbers.
 */

const TableCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const TableHeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  paddingBottom: "16px",
  borderBottom: `1px solid ${theme.custom.colors.silverGrayDark}`,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const TableHeaderCell = styled("div", {
  shouldForwardProp: (prop) => prop !== "$flex" && prop !== "$numeric",
})<{ $flex: number; $numeric?: boolean }>(({ $flex, $numeric, theme }) => ({
  flex: $flex,
  minWidth: 0,
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  ...($numeric && { textAlign: "right" }),
}))

const TableRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: `1px solid ${theme.custom.colors.silverGrayLight}`,
  "&:last-child": {
    borderBottom: "none",
  },
  [theme.breakpoints.down("md")]: {
    position: "relative",
    flexWrap: "wrap",
    gap: "6px 0",
    padding: "16px 40px 16px 0",
  },
}))

const MobileLabel = styled.span(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("md")]: {
    display: "inline",
    ...theme.typography.subtitle2,
    color: theme.custom.colors.darkGray2,
    minWidth: "120px",
    flexShrink: 0,
  },
}))

const TableCell = styled("div", {
  shouldForwardProp: (prop) =>
    prop !== "$flex" && prop !== "$primary" && prop !== "$numeric",
})<{ $flex: number; $primary?: boolean; $numeric?: boolean }>(
  ({ $flex, $primary, $numeric, theme }) => ({
    flex: $flex,
    minWidth: 0,
    ...theme.typography.body2,
    color: theme.custom.colors.black,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ...($numeric && {
      textAlign: "right",
      // Digits line up column-wise only if they share an advance width.
      fontVariantNumeric: "tabular-nums",
    }),
    [theme.breakpoints.down("md")]: {
      flex: "none",
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      overflow: "visible",
      whiteSpace: "normal",
      // Stacked rows read as "label: value" pairs, so the desktop right-align
      // would strand the value away from its label.
      textAlign: "left",
      ...($primary && {
        ...theme.typography.subtitle2,
        marginBottom: "4px",
      }),
    },
  }),
)

const TableFooter = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: "16px",
})

const TableFootnote = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const EmptyTableMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  padding: "32px 0",
  textAlign: "center",
})) as typeof Typography

/** Placeholder for a value the API did not return. */
const STUB = "—"

export {
  EmptyTableMessage,
  MobileLabel,
  STUB,
  TableCard,
  TableCell,
  TableFooter,
  TableFootnote,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
}
