import React from "react"
import { styled, SimpleSelect } from "ol-components"
import { Checkbox } from "@mitodl/smoot-design"
import type { UseResourceSearchParamsResult } from "@mitodl/course-search-utils"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { getCertificationTypeName } from "@mitodl/course-search-utils"
import { CertificationTypeEnum, DeliveryEnum } from "api"

/**
 * The search and filter bar on a topic page, per the design.
 *
 * One white card holding the search box and three controls, rather than the
 * facet sidebar the other channels use: a topic page narrows by format,
 * certificate and price, and the rest of the facets are not offered here.
 *
 * The red edge and the lift are the design's -- a 2px rule on the leading edge
 * and a soft shadow, which is what separates the card from the grey ground it
 * sits on.
 */
const Card = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "24px",
  padding: "24px",
  /* The rule sits inside the design's 24px inset rather than adding to it. */
  paddingLeft: "22px",
  borderRadius: "8px",
  borderLeft: `2px solid ${theme.custom.colors.lightRed}`,
  backgroundColor: theme.custom.colors.white,
  filter: "drop-shadow(0px 3px 2.5px rgba(120, 147, 172, 0.1))",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: "16px",
  },
}))

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
  width: "486px",
  flexShrink: 0,
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
  flex: "1 0 0",
  minWidth: 0,
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
  /* The design's control is the label and a chevron, with no field chrome. */
  ".MuiOutlinedInput-notchedOutline": { border: "none" },
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

/** "Format" in the design is the `delivery` facet -- see `getFacetManifest`. */
const DELIVERY_OPTIONS = Object.values(DeliveryEnum).map((value) => ({
  value,
  label: value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-"),
}))

const CERTIFICATION_OPTIONS = Object.values(CertificationTypeEnum).map(
  (value) => ({
    value,
    label: getCertificationTypeName(value) || value,
  }),
)

type TopicSearchFilterBarProps = {
  currentText: string
  setCurrentText: (text: string) => void
  setCurrentTextAndQuery: (text: string) => void
  setPage: (page: number) => void
  params: UseResourceSearchParamsResult["params"]
  setParamValue: UseResourceSearchParamsResult["setParamValue"]
  toggleParamValue: UseResourceSearchParamsResult["toggleParamValue"]
}

const TopicSearchFilterBar: React.FC<TopicSearchFilterBarProps> = ({
  currentText,
  setCurrentText,
  setCurrentTextAndQuery,
  setPage,
  params,
  setParamValue,
  toggleParamValue,
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
          options={DELIVERY_OPTIONS}
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
          options={CERTIFICATION_OPTIONS}
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
