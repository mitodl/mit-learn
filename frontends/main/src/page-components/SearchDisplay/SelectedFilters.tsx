import React from "react"
import { styled } from "ol-components"
import { RiCloseLine } from "@remixicon/react"
import type {
  FacetManifest,
  UseResourceSearchParamsResult,
} from "@mitodl/course-search-utils"

type SearchParams = UseResourceSearchParamsResult["params"]

type SelectedFilter = {
  /** The facet's own param name, and the value to drop from it. */
  name: string
  value: string
  label: string
}

/**
 * One facet's setting, read out of the params by name.
 *
 * By name rather than by key, because the two lists are not the same list:
 * the manifest holds the facets the page offers, including ones that only
 * ever arrive in the URL, while the params type holds what the search request
 * accepts. A facet in the one and not the other does not stop a value being
 * read at runtime, but it does stop the lookup compiling.
 */
const facetSetting = (params: SearchParams, name: string): unknown =>
  (params as Record<string, unknown>)[name]

const facetValues = (params: SearchParams, name: string): string[] => {
  const setting = facetSetting(params, name)
  return Array.isArray(setting)
    ? setting.filter((value): value is string => typeof value === "string")
    : []
}

/**
 * The facet values currently narrowing the results, in the manifest's order.
 *
 * Read from the manifest rather than from a list kept here, so a facet that
 * only ever arrives in the URL still names itself, and so a value is labelled
 * with whatever already labels it wherever else the facet is drawn -- the
 * manifest is where "in_person" becomes "In-Person" and "professional"
 * becomes "Professional Certificate".
 */
const selectedFilters = (
  facetManifest: FacetManifest,
  params: SearchParams,
): SelectedFilter[] =>
  facetManifest.flatMap((facet): SelectedFilter[] => {
    if (facet.type === "group") {
      /* A boolean facet is either on or off, so the group's own label is the
         whole chip -- there is no value to name beside it. */
      return facet.facets
        .filter((member) => facetSetting(params, member.name) === member.value)
        .map((member) => ({
          name: member.name,
          value: String(member.value),
          label: member.label,
        }))
    }
    return facetValues(params, facet.name).map((value) => ({
      name: facet.name,
      value,
      label: facet.labelFunction?.(value) ?? value,
    }))
  })

/**
 * The row of applied filters, set off from the search row above it by a rule.
 *
 * The rule and the padding under it belong to this row rather than to the card
 * because the row is what comes and goes: with nothing filtering there is
 * nothing to separate, and a card that drew its own rule would be left with a
 * line under its only row.
 */
const Row = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  paddingTop: "16px",
  /* Narrow screens run out of room long before the filters do. */
  flexWrap: "wrap",
  rowGap: "8px",
}))

/** Says what the row is, since the filters alone do not announce themselves. */
const FilteredBy = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray1,
  whiteSpace: "nowrap",
}))

/**
 * One filter, which removing is the only thing it does.
 *
 * A button rather than the chip component used elsewhere, because removing is
 * the whole of it: the design draws the filter's name and a cross in a small
 * grey tablet, and the tablet is the control.
 *
 * 8px of its own on the label's side and 4px around the cross, which is what
 * makes the design's 24px -- the cross carries its own space, so the two sides
 * are set differently rather than padded alike.
 */
const FilterChip = styled.button(({ theme }) => ({
  ...theme.typography.subtitle3,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  height: "24px",
  padding: "0 4px 0 8px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.darkGray2,
  cursor: "pointer",
  whiteSpace: "nowrap",
  svg: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
  },
  /* Nothing in the design says what hovering does, and the tablet is already
     drawn as something to operate -- so it deepens by one step of its own
     grey rather than taking an outline or a colour from elsewhere. */
  ":hover": {
    backgroundColor: theme.custom.colors.lightGray2,
  },
}))

const ClearAll = styled.button(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  /* 8px on top of the row's own 12px, which is the 20px the design sets it in
     from the last filter. The gap belongs to the link, not to the row. */
  marginLeft: "8px",
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
  ":hover": {
    textDecorationLine: "underline",
  },
}))

type SelectedFiltersProps = {
  facetManifest: FacetManifest
  params: SearchParams
  onRemove: (name: string, value: string) => void
  onClearAll: () => void
  /**
   * Where focus goes when the last filter is removed and the row unmounts
   * with it -- there is no chip left to hand it to.
   */
  onEmpty: () => void
}

/**
 * The filters currently applied, each one removable, above the results.
 *
 * The topic page's filter controls are dropdowns that close over what they
 * selected, so without this the only record of what is narrowing the results
 * is inside a control the reader has to open. Naming them here also gives
 * each one somewhere to be switched off individually, which "Clear all"
 * alone does not.
 *
 * Renders nothing when nothing is filtering: the row is about the filters, so
 * with none there is no count to qualify and nothing to clear.
 */
const SelectedFilters: React.FC<SelectedFiltersProps> = ({
  facetManifest,
  params,
  onRemove,
  onClearAll,
  onEmpty,
}) => {
  const filters = selectedFilters(facetManifest, params)
  const chipRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  /**
   * Hand focus on before the chip holding it goes away.
   *
   * Removing a filter unmounts the chip that removed it, and the browser
   * drops focus to the body rather than passing it on -- so a keyboard user
   * is returned to the top of the document after every removal. The next chip
   * takes it, or the previous one where the last was removed; when the last
   * filter goes the row goes with it, and `onEmpty` says where focus belongs
   * instead.
   */
  const removeAndMoveFocus = (index: number) => {
    const remaining = filters.filter((_, position) => position !== index)
    if (remaining.length === 0) {
      onEmpty()
    } else {
      const next = remaining[Math.min(index, remaining.length - 1)]
      chipRefs.current[`${next.name}-${next.value}`]?.focus()
    }
    onRemove(filters[index].name, filters[index].value)
  }

  if (filters.length === 0) {
    return null
  }
  return (
    <Row data-testid="selected-filters">
      <FilteredBy>Filtered by</FilteredBy>
      {filters.map((filter, index) => {
        const key = `${filter.name}-${filter.value}`
        return (
          <FilterChip
            key={key}
            ref={(node) => {
              chipRefs.current[key] = node
            }}
            type="button"
            aria-label={`Remove filter ${filter.label}`}
            onClick={() => removeAndMoveFocus(index)}
          >
            {filter.label}
            <RiCloseLine aria-hidden />
          </FilterChip>
        )
      })}
      {/* Labelled in full for assistive tech: the visible words are short
          because the row they end already says these are the filters, which a
          control read out on its own does not. */}
      <ClearAll
        type="button"
        aria-label="Clear all filters"
        onClick={() => {
          onEmpty()
          onClearAll()
        }}
      >
        Clear all
      </ClearAll>
    </Row>
  )
}

export default SelectedFilters
export { selectedFilters }
