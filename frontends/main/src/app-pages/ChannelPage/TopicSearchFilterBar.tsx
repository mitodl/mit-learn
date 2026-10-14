import React from "react"
import { styled, SimpleSelect, theme } from "ol-components"
import { Checkbox } from "@mitodl/smoot-design"
import type { UseResourceSearchParamsResult } from "@mitodl/course-search-utils"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { getCertificationTypeName } from "@mitodl/course-search-utils"
import { CertificationTypeEnum, DeliveryEnum } from "api"
import type { LearningResourcesSearchResponse } from "api"

type Aggregations = LearningResourcesSearchResponse["metadata"]["aggregations"]

/**
 * The search and filter row on a topic page: the search box and three
 * controls, rather than the facet sidebar the other channels use. A topic
 * page narrows by format, certificate and price, and the rest of the facets
 * are not offered here.
 *
 * The card around it belongs to the results header it shares with the tabs
 * and the applied filters -- see `TopicSearchCard` in `SearchDisplay`.
 */
const Card = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "24px",
  height: "48px",
  width: "100%",
})

/**
 * The design's search box: 486x48, and everything about the frame -- the
 * border, the 4px radius, the lift, the 16px inset, the 48px button with its
 * 24px glass -- is what the shared field's large size already gives it.
 *
 * Its text is the exception. The large size sets 16/20, where the design sets
 * the line at 14/18, so the placeholder and whatever is typed over it are
 * both a size smaller here than the field draws them elsewhere.
 */
const StyledSearchField = styled(SearchField)(({ theme }) => ({
  width: "626px",
  /* The elastic one of the two: the controls beside it are a fixed set of
     fixed-width labels, so between `md` and the ~1080px the design's width
     needs, the room has to come from the field. `min-width` because a flex
     item will not shrink past its content otherwise, and the field's content
     is a long placeholder. */
  minWidth: 0,
  gap: "8px",
  input: {
    ...theme.typography.body2,
  },
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
}))

const Facets = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  /* 8px either side of each hairline, as the design spaces them. */
  gap: "16px",
  /**
   * Sized by what it holds, and given the rest of the row on top. A zero
   * basis would take only the room left after the field's 626px, which
   * between `md` and ~1080px is less than the controls measure -- they then
   * run out of the card and take the page's width with them. Growing from
   * their own width instead keeps the controls against the right edge where
   * there is room, and leaves the field to give some up where there is not.
   */
  flex: "1 0 auto",
  [theme.breakpoints.down("md")]: {
    flexWrap: "wrap",
  },
}))

/** The 21px hairlines between the controls. */
const Divider = styled.div(({ theme }) => ({
  width: "1px",
  height: "21px",
  flexShrink: 0,
  backgroundColor: theme.custom.colors.lightGray2,
}))

/**
 * A facet as a dropdown rather than an expandable list. `SimpleSelect` is what
 * the sort control beside the tabs already uses, so the two read as one family.
 */
const FacetSelect = styled(SimpleSelect)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  /* The design's control is the label and a chevron, with no field chrome.
     The background goes with the border: left white it reads as a box
     against the card's gradient, which is the chrome by another name. */
  ".MuiOutlinedInput-notchedOutline": { border: "none" },
  "&&": { backgroundColor: "transparent" },
  /**
   * The design's 36px control: 12px either side of an 18px line, 4px between
   * the label and a 20px chevron, and 12px from the chevron to the right edge.
   * With no border to align to, these are what set the control's width.
   *
   * The right padding has to clear the chevron, which is positioned over the
   * field rather than laid out in it -- 4 + 20 + 12. The selector is tripled
   * to outweigh Select's own clearance for its smaller icon, which it sets as
   * `padding-right` behind a thrice-repeated class; at any less than this the
   * two tie, Select's rule lands later, and the chevron crowds the label.
   */
  height: "36px",
  border: "none",
  "&&& .MuiSelect-select": { padding: "9px 36px 9px 12px" },
  ".MuiSelect-icon": {
    width: "20px",
    height: "20px",
    fontSize: "20px",
    right: "12px",
  },
}))

const FreeCheckbox = styled(Checkbox)(({ theme }) => ({
  margin: 0,
  padding: 0,
  ".MuiFormControlLabel-label, label": {
    ...theme.typography.body2,
    color: theme.custom.colors.silverGrayDark,
  },
}))

/**
 * A row in a facet's menu: what it is, and how many results carry it.
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

const MenuCount = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  marginLeft: "auto",
  paddingLeft: "8px",
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
          backgroundColor: "transparent",
          color: theme.custom.colors.darkGray2,
        },
    },
  },
}

/** A facet's options, each with its own count out of the current search. */
const facetOptions = (
  values: readonly string[],
  labelFor: (value: string) => string,
  selected: string[],
  counts: Record<string, number>,
) =>
  values.map((value) => ({
    value,
    label: (
      <MenuRow>
        <MenuBox checked={selected.includes(value)} aria-hidden />
        {labelFor(value)}
        <MenuCount>{counts[value] ?? 0}</MenuCount>
      </MenuRow>
    ),
  }))

/** The counts a search came back with, by facet value. */
const countsFor = (aggregations: Aggregations, name: string) =>
  Object.fromEntries(
    (aggregations?.[name] ?? []).map((bucket) => [
      bucket.key,
      bucket.doc_count,
    ]),
  )

/** "Format" in the design is the `delivery` facet -- see `getFacetManifest`. */
const DELIVERY_VALUES = Object.values(DeliveryEnum)
const deliveryLabel = (value: string) =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-")

const CERTIFICATION_VALUES = Object.values(CertificationTypeEnum)
const certificationLabel = (value: string) =>
  getCertificationTypeName(value) || value

type TopicSearchFilterBarProps = {
  currentText: string
  setCurrentText: (text: string) => void
  setCurrentTextAndQuery: (text: string) => void
  setPage: (page: number) => void
  params: UseResourceSearchParamsResult["params"]
  setParamValue: UseResourceSearchParamsResult["setParamValue"]
  toggleParamValue: UseResourceSearchParamsResult["toggleParamValue"]
  /** Counts from the current search, shown beside each option. */
  aggregations: Aggregations
}

const TopicSearchFilterBar: React.FC<TopicSearchFilterBarProps> = ({
  currentText,
  setCurrentText,
  setCurrentTextAndQuery,
  setPage,
  params,
  setParamValue,
  toggleParamValue,
  aggregations,
}) => {
  const delivery = params.delivery ?? []
  const certification = params.certification_type ?? []
  /* `free` is a boolean facet rather than a list of values. */
  const isFree = !!params.free
  return (
    <Card data-testid="topic-search-filter-bar">
      <StyledSearchField
        value={currentText}
        /* 48px, which is what makes the card the design's 96px tall. */
        size="large"
        placeholder="Search for courses, programs, and learning materials..."
        onChange={(e) => setCurrentText(e.target.value)}
        onSubmit={(e) => setCurrentTextAndQuery(e.target.value)}
        onClear={() => setCurrentTextAndQuery("")}
        setPage={setPage}
      />
      <Facets>
        <FacetSelect
          size="small"
          name="delivery"
          aria-label="Format"
          value={delivery}
          multiple
          renderValue={() => "Format"}
          MenuProps={FACET_MENU_PROPS}
          options={facetOptions(
            DELIVERY_VALUES,
            deliveryLabel,
            delivery,
            countsFor(aggregations, "delivery"),
          )}
          onChange={(event) => {
            setParamValue("delivery", event.target.value as string[])
            setPage(1)
          }}
        />
        <Divider />
        <FacetSelect
          size="small"
          name="certification_type"
          aria-label="Certificate"
          value={certification}
          multiple
          renderValue={() => "Certificate"}
          MenuProps={FACET_MENU_PROPS}
          options={facetOptions(
            CERTIFICATION_VALUES,
            certificationLabel,
            certification,
            countsFor(aggregations, "certification_type"),
          )}
          onChange={(event) => {
            setParamValue("certification_type", event.target.value as string[])
            setPage(1)
          }}
        />
        <Divider />
        <FreeCheckbox
          label="Free"
          checked={isFree}
          onChange={(event) => {
            toggleParamValue("free", "true", event.target.checked)
            setPage(1)
          }}
        />
      </Facets>
    </Card>
  )
}

export default TopicSearchFilterBar
