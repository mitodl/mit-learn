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

const Row = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  /* Takes the row so that whatever sits beside it stays at the far edge. */
  flex: "1 0 0",
  minWidth: 0,
  /* Narrow screens run out of room long before the filters do. */
  flexWrap: "wrap",
  rowGap: "8px",
  color: theme.custom.colors.silverGrayDark,
}))

const ResultCount = styled.span(({ theme }) => ({
  ...theme.typography.subtitle3,
  fontWeight: theme.typography.fontWeightBold,
  whiteSpace: "nowrap",
}))

/**
 * One filter, which removing is the only thing it does.
 *
 * A button rather than the chip component used elsewhere: the design draws no
 * container around it at all, just the cross and the words.
 */
const FilterChip = styled.button(({ theme }) => ({
  ...theme.typography.body3,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  svg: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
  },
  ":hover": {
    color: theme.custom.colors.darkGray2,
  },
}))

const ClearAll = styled.button(({ theme }) => ({
  ...theme.typography.subtitle3,
  fontWeight: theme.typography.fontWeightBold,
  color: theme.custom.colors.darkRed,
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
  /** Total matching the current filters, as the design states it. */
  count?: number
  onRemove: (name: string, value: string) => void
  onClearAll: () => void
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
  count,
  onRemove,
  onClearAll,
}) => {
  const filters = selectedFilters(facetManifest, params)
  if (filters.length === 0) {
    return null
  }
  return (
    <Row data-testid="selected-filters">
      <ResultCount>
        {count === undefined
          ? "Results for:"
          : `${count} ${count === 1 ? "result" : "results"} for:`}
      </ResultCount>
      {filters.map((filter) => (
        <FilterChip
          key={`${filter.name}-${filter.value}`}
          type="button"
          aria-label={`Remove filter ${filter.label}`}
          onClick={() => onRemove(filter.name, filter.value)}
        >
          <RiCloseLine aria-hidden />
          {filter.label}
        </FilterChip>
      ))}
      <ClearAll type="button" onClick={onClearAll}>
        Clear all filters
      </ClearAll>
    </Row>
  )
}

export default SelectedFilters
export { selectedFilters }
