import { styled } from "@mitodl/smoot-design"

/**
 * Responsive grid that lays out the meta box and offering boxes side-by-side
 * on tablet. On desktop sidebar and mobile it stays single-column.
 *
 * Count-aware CSS:
 *   - data-boxes="3" (Both case): meta spans both columns; paid + free auto-flow.
 *   - data-boxes="1" (no runs): force single column.
 *   - data-boxes="2": auto-flow places meta + one offering box side by side.
 *
 * The "Choose Your Path" heading (emitted by CourseEnrollArea in the Both case)
 * always spans both columns via the [data-choose-path] selector.
 */
export const BoxGrid = styled.div(({ theme: t }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px",
  padding: "24px",
  [t.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [t.breakpoints.down("sm")]: {
    padding: "16px",
  },
  [t.breakpoints.between("sm", "md")]: {
    gridTemplateColumns: "1fr 1fr",
    // 3-box (Both): meta spans both columns; offering boxes auto-flow beneath
    "&[data-boxes='3'] [data-grid-meta]": {
      gridColumn: "1 / -1",
    },
    // 3-box (Both): "Choose Your Path" heading spans both columns
    "&[data-boxes='3'] [data-choose-path]": {
      gridColumn: "1 / -1",
    },
    // 1-box (no runs): collapse back to single column
    "&[data-boxes='1']": {
      gridTemplateColumns: "1fr",
    },
    // In the 3-box (Both) layout the two offering cells share a row and stretch
    // to equal height (grid default); each card's own `fill` prop handles the
    // rest (see TrackCard), so no card-internal CSS lives here.
  },
}))

/**
 * Full-width rule separating the metadata block from the "Choose Your Path"
 * offering(s). Single-column only — hidden in the tablet 2-column grid, where
 * meta and offerings sit side by side and a horizontal rule would not apply.
 */
export const SectionDivider = styled.hr(({ theme: t }) => ({
  border: "none",
  borderTop: `1px solid ${t.custom.colors.lightGray2}`,
  width: "100%",
  margin: 0,
  gridColumn: "1 / -1",
  [t.breakpoints.between("sm", "md")]: {
    display: "none",
  },
}))
