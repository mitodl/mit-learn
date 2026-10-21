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

const Row = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  width: "100%",
  /* Narrow screens run out of room long before the filters do. */
  flexWrap: "wrap",
  rowGap: "8px",
})

/**
 * One filter, which removing is the only thing it does.
 *
 * A button rather than the chip component used elsewhere, because removing is
 * the whole of it: the design draws an outlined pill with the filter's name
 * and a cross, and the pill is the control.
 */
const FilterChip = styled.button(({ theme }) => ({
  ...theme.typography.body2,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  height: "32px",
  /* Less on the cross's side, which carries its own space. */
  padding: "0 12px 0 16px",
  borderRadius: "20px",
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  /* Filled rather than left clear: the row sits on the page's own grey, and
     the design draws the pills white against it. */
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.darkGray2,
  cursor: "pointer",
  whiteSpace: "nowrap",
  svg: {
    flexShrink: 0,
    width: "16px",
    height: "16px",
    color: theme.custom.colors.silverGrayDark,
  },
  ":hover": {
    borderColor: theme.custom.colors.darkGray2,
    svg: { color: theme.custom.colors.darkGray2 },
  },
}))

const ClearAll = styled.button(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.red,
  /* Set in from the last pill rather than spaced from it, as the design has
     it -- the gap belongs to the link, not to the row. */
  padding: "0 16px",
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
  /**
   * Set by whoever places the row, which is where the row's own place on the
   * page is decided. Here rather than on a wrapper because the row renders
   * nothing when nothing is filtering, and a wrapper would hold its space
   * open anyway.
   */
  className?: string
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
  className,
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
    <Row className={className} data-testid="selected-filters">
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
      <ClearAll
        type="button"
        onClick={() => {
          onEmpty()
          onClearAll()
        }}
      >
        Clear all filters
      </ClearAll>
    </Row>
  )
}

export default SelectedFilters
export { selectedFilters }
