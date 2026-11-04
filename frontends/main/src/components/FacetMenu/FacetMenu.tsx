import React from "react"
import { styled, theme } from "ol-components"

/**
 * What the control says: its name, and how many of its values are narrowing
 * the results.
 *
 * The menu closes over what it selected, so without this the control reads
 * exactly the same whether or not it is filtering anything. The chips above
 * the results name the values; this says only how many, which is what there
 * is room for beside a label.
 */
const FacetLabel = styled.span({
  display: "flex",
  alignItems: "center",
  /* The design's 4px between the label and what follows it. */
  gap: "4px",
})

/**
 * The count beside a narrowed facet's name, as the design draws it: a 20px
 * red disc with the number in white.
 *
 * Hidden rather than shown as a nought when the facet is not narrowing
 * anything -- a badge reading 0 is a filter announcing that it is not
 * filtering.
 */
const FacetCount = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  width: "20px",
  height: "20px",
  borderRadius: "100px",
  backgroundColor: theme.custom.colors.red,
  color: theme.custom.colors.white,
  fontSize: "10px",
  lineHeight: "14px",
  fontWeight: theme.typography.fontWeightMedium,
}))

/** A facet control's label, with the count of what it has narrowed by. */
const facetLabel = (label: string, selected: string[]) => (
  <FacetLabel>
    {label}
    {selected.length > 0 ? (
      <FacetCount aria-hidden="true">{selected.length}</FacetCount>
    ) : null}
  </FacetLabel>
)

/**
 * What the control is called to a screen reader, which has to carry the count
 * itself: `aria-label` on a combobox replaces everything drawn inside it, so
 * the disc is never read as part of the name. Naming the disc instead does not
 * work either -- it is a span with no role, which `aria-label` cannot name --
 * so it is hidden above and said here.
 */
const facetName = (label: string, selected: string[]) =>
  selected.length > 0 ? `${label}, ${selected.length} selected` : label

/**
 * A row in a facet's menu.
 *
 * The box is drawn rather than wired: the menu item it sits in is the
 * control, and carries the selected state to a screen reader itself, so a
 * second checkbox here would be a second thing to operate and to announce.
 */
const MenuRow = styled.span({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
})

const MenuBox = styled.span<{ checked: boolean }>(({ theme, checked }) => ({
  flexShrink: 0,
  boxSizing: "border-box",
  width: "20px",
  height: "20px",
  borderRadius: "2px",
  border: `1px solid ${checked ? theme.custom.colors.mitRed : theme.custom.colors.silverGray}`,
  backgroundColor: checked ? theme.custom.colors.mitRed : "transparent",
  /* The tick, drawn as two sides of a rotated box. */
  "::after": checked
    ? {
        content: '""',
        display: "block",
        width: "5px",
        height: "9px",
        margin: "2px auto",
        border: `solid ${theme.custom.colors.white}`,
        borderWidth: "0 2px 2px 0",
        transform: "rotate(45deg)",
      }
    : undefined,
}))

/** The menu's own paper, which renders in a portal. */
const FACET_MENU_PROPS = {
  /**
   * Hung below the control rather than over it. Select's default menu lines
   * the chosen option up with the control, which puts the list across the
   * button it came from; these are a short list under a short label, so the
   * button stays visible and the list reads as belonging to it.
   */
  variant: "menu" as const,
  anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
  transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
  PaperProps: {
    sx: {
      width: "270px",
      borderRadius: "8px",
      boxShadow: "1px 3px 20px 0 rgba(0, 0, 0, 0.12)",

      padding: "16px",
      border: `1px solid ${theme.custom.colors.lightGray1}`,
      "& .MuiList-root": {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: 0,
      },
      /* The box is what says a row is chosen. The shared menu item says it
         again by filling the row red and turning the words white, which this
         design does not do -- doubled to outweigh it, since the two rules are
         otherwise of equal weight and its own lands later. */
      "&& .MuiMenuItem-root, && .MuiMenuItem-root.Mui-selected, && .MuiMenuItem-root.Mui-selected:hover":
        {
          padding: 0,
          minHeight: "unset",
          /** MenuItem's own `nowrap` would clip a long label at the paper's fixed width, since the paper hides its overflow. */
          whiteSpace: "normal",
          backgroundColor: "transparent",
          color: theme.custom.colors.darkGray2,
        },
    },
  },
}

export {
  FACET_MENU_PROPS,
  FacetCount,
  FacetLabel,
  facetLabel,
  facetName,
  MenuBox,
  MenuRow,
}
