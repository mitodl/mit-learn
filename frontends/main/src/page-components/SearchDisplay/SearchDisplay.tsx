import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  styled,
  Pagination,
  PaginationItem,
  PlainList,
  Container,
  Typography,
  SimpleSelect,
  css,
  Drawer,
  Stack,
  Grid2 as Grid,
} from "ol-components"
import {
  Button,
  ButtonProps,
  childCheckboxStyles,
  VisuallyHidden,
  Checkbox,
} from "@mitodl/smoot-design"
import { keyBy } from "lodash"
import {
  RiCloseLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiEqualizerLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
} from "@remixicon/react"
import {
  useOfferorsList,
  learningResourceQueries,
} from "api/hooks/learningResources"
import {
  LearningResource,
  LearningResourcesSearchApiLearningResourcesSearchRetrieveRequest as LRSearchRequest,
  LearningResourcesSearchResponse,
  ResourceTypeGroupEnum,
  SearchModeEnumDescriptions,
} from "api"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useAdminSearchParams } from "api/hooks/adminSearchParams"
import {
  AvailableFacets,
  UseResourceSearchParamsProps,
  UseResourceSearchParamsResult,
} from "@mitodl/course-search-utils"
import type {
  Facets,
  BooleanFacets,
  FacetManifest,
} from "@mitodl/course-search-utils"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import { ResourceTypeGroupTabs } from "./ResourceTypeGroupTabs"
import ProfessionalToggle from "./ProfessionalToggle"
import { useTrackedFilterSetters } from "@/common/analytics/searchFilters"
import SliderInput from "./SliderInput"
import VectorAdminOptions from "./VectorAdminOptions"
import { AdminTitleContainer, ExplanationContainer } from "./adminStyles"

import type { TabConfig } from "./ResourceTypeGroupTabs"

import { ResourceCard } from "../ResourceCard/ResourceCard"
import { useUserMe } from "api/hooks/user"
import getSearchParams from "./getSearchParams"
import UniversalAIBanner from "./UniversalAIBanner"
import AiSearchOverview from "./AiSearchOverview"

const StyledResourceTabs = styled(ResourceTypeGroupTabs.TabList)`
  margin-top: 0;
`

const DesktopSortContainer = styled.div`
  ${({ theme }) => theme.breakpoints.down("md")} {
    display: none;
  }
`
const MobileSortContainer = styled.div`
  float: right;
  ${({ theme }) => theme.breakpoints.up("md")} {
    display: none;
  }
`

const SearchModeDropdownContainer = styled.div`
  margin-top: 10px;
  margin-bottom: 10px;
`

const FacetStyles = styled.div`
  margin-top: 8px;

  div.facets:last-child {
    border-bottom-right-radius: 8px;
    border-bottom-left-radius: 8px;
    border-bottom: solid 1px ${({ theme }) => theme.custom.colors.lightGray2};
  }

  div.facets:not(.multi-facet-group) {
    border-top-right-radius: 8px;
    border-top-left-radius: 8px;
  }

  div.facets:not(.multi-facet-group) + div.facets:not(.multi-facet-group) {
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }

  input[type="text"] {
    border: solid 1px ${({ theme }) => theme.custom.colors.lightGray2};
    margin-bottom: 16px;
    margin-top: 12px;
    border-radius: 4px;
    color: ${({ theme }) => theme.custom.colors.darkGray2};
    ${({ theme }) => css({ ...theme.typography.body2 })}

    &:focus-visible {
      outline: solid 2px ${({ theme }) => theme.custom.colors.darkGray2};
    }
  }

  .filter-section-button {
    ${({ theme }) => css({ ...theme.typography.subtitle2 })}
    color: ${({ theme }) => theme.custom.colors.darkGray2};
    padding: 0;
    background-color: transparent;
    display: flex;
    width: 100%;
    border: none;
    cursor: pointer;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;

    i {
      color: ${({ theme }) => theme.custom.colors.silverGrayDark};

      svg {
        display: block;
      }
    }

    &:hover i {
      color: ${({ theme }) => theme.custom.colors.darkGray2};
    }
  }

  .facet-label {
    font-size: 14px;
    justify-content: space-between;
    display: flex;
    flex-direction: row;
    flex: 1;
    min-width: 0;
    align-items: center;

    .facet-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: ${({ theme }) => theme.custom.colors.silverGrayDark};
    }
  }

  .facet-list {
    margin-bottom: 8px;
  }

  .facets {
    box-sizing: border-box;
    background-color: ${({ theme }) => theme.custom.colors.white};
    border: solid 1px ${({ theme }) => theme.custom.colors.lightGray2};
    border-bottom: none;
    padding: 16px;
    padding-left: 24px;
    padding-right: 24px;
    margin-top: 0;
    margin-bottom: 0;
    max-height: 55px;
    transition: max-height 0.4s ease-out;
    overflow: hidden;

    &.facets-expanded {
      max-height: 600px;

      &.admin-facet {
        max-height: fit-content;
      }

      transition: max-height 0.4s ease-in;
    }

    .facet-visible {
      display: flex;
      flex-direction: row;
      align-items: center;
      height: 25px;
      font-size: 0.875em;
      gap: 4px;
      margin-left: -2px;
      margin-top: 6px;
      margin-bottom: 6px;

      &:last-child {
        margin-bottom: 8px;
      }

      input,
      .facet-label {
        cursor: pointer;
      }

      ${({ theme }) => childCheckboxStyles(theme)}

      .facet-count {
        font-size: 12px;
        padding-left: 8px;
        color: ${({ theme }) => theme.custom.colors.silverGrayDark};
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      &.checked,
      &:hover {
        .facet-label .facet-text {
          color: ${({ theme }) => theme.custom.colors.darkGray2};
        }
      }
    }

    .facet-more-less {
      cursor: pointer;
      color: ${({ theme }) => theme.palette.text.secondary};
      font-size: ${({ theme }) => theme.typography.body2.fontSize};
      text-align: right;
    }
  }

  .facets:not(.facets-expanded, .facets-transitioning):has(
      button.filter-section-button
    ) {
    div.facet-visible,
    div.facet-list,
    div.input-wrapper {
      visibility: hidden;
    }
  }

  .filterable-facet {
    .facet-list {
      max-height: 400px;
      overflow: auto;
      padding-right: 0.5rem;
    }

    .input-wrapper {
      position: relative;
      margin-bottom: 10px;

      .input-postfix-icon {
        display: none;
      }

      .input-postfix-button {
        cursor: pointer;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        border: none;
        background: none;
        padding: 0;
        width: 20px;
        height: 20px;
        right: 7px;

        svg {
          color: ${({ theme }) => theme.custom.colors.silverGrayLight};
          width: 100%;
          height: 100%;
          display: block;

          :hover {
            color: ${({ theme }) => theme.custom.colors.darkGray2};
          }
        }

        span {
          color: ${({ theme }) => theme.palette.text.secondary};
        }
      }
    }
  }

  input.facet-filter {
    background-color: initial;
    padding: 10px 26px 10px 10px;
    margin-top: 0;
    margin-bottom: 0;
    width: 100%;
  }

  .facets.multi-facet-group {
    background: white;
    margin-top: 8px;
    margin-bottom: 8px;
    border-radius: 8px;
    border-bottom: solid 1px ${({ theme }) => theme.custom.colors.lightGray2};
    padding-top: 12px;
    padding-bottom: 12px;

    .facet-visible {
      margin-top: 0;
      margin-bottom: 0;
    }

    .facet-visible .facet-label {
      .facet-text,
      .facet-count {
        color: ${({ theme }) => theme.custom.colors.darkGray2};
      }

      margin-bottom: 0;
    }
  }
`

const FilterTitle = styled.div`
  svg {
    margin-left: 8px;
  }

  margin-right: 1rem;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  color: ${({ theme }) => theme.custom.colors.darkGray2};
`

const FacetsTitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  min-height: 40px;
  align-items: end;
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: end;
  margin-top: 24px;
  margin-bottom: 80px;

  ${({ theme }) => theme.breakpoints.down("md")} {
    margin-top: 16px;
    margin-bottom: 24px;
  }

  ul li button.Mui-selected {
    ${({ theme }) => css({ ...theme.typography.subtitle1 })}
    background-color: inherit;
  }

  ul li button svg {
    background-color: ${({ theme }) => theme.custom.colors.lightGray2};
    border-radius: 4px;
    width: 1.5em;
    height: 1.5em;
    padding: 0.25em;
  }
`

const StyledResultsContainer = styled.div<{ fetching: boolean }>(
  ({ fetching }) => ({
    "ul > li + li": {
      marginTop: "8px",
    },

    opacity: fetching ? 0.5 : 1,
  }),
)

/**
 * The results as a grid, for `resultsLayout="cards"`: four across at desktop,
 * as the design has it, with the same 24px gutter as the cards above it.
 *
 * Still a list, as the rows are: laying the items out in a grid is no reason
 * for a screen reader to stop announcing how many results there are and which
 * one it is on. Built on `PlainList` so the items carry the same reset, and
 * spaced by the grid's gap rather than its `itemSpacing`.
 */
const CardGrid = styled(PlainList)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "24px",
  [theme.breakpoints.down("lg")]: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
}))

const MobileFilter = styled.div`
  ${({ theme }) => theme.breakpoints.up("md")} {
    display: none;
  }

  color: ${({ theme }) => theme.custom.colors.darkGray2};
  margin-top: 20px;
  margin-bottom: 16px;
`
const FilterButton = styled(Button)({
  marginLeft: "-8px",
  minWidth: 0,
})

const StyledDrawer = styled(Drawer)`
  .MuiPaper-root {
    max-width: 332px;
    width: 85%;
    padding: 16px;
    background-color: ${({ theme }) => theme.custom.colors.lightGray1};
  }
`

const MobileFacetSearchButtons = styled.div`
  display: flex;
  gap: 12px;

  & > button {
    flex: 1;
  }
`
const ResetButton = styled((props: Omit<ButtonProps, "variant">) => (
  <Button {...props} variant="text" />
))(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
}))

const MobileDrawerCloseButton = styled(Button)`
  svg {
    height: 1.5em;
    width: 1.5em;
  }

  padding-right: 0;
`

const MobileFacetsTitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  min-height: 45px;
  align-items: end;

  div div {
    float: left;
    margin-right: 10px;
    padding: 10px;
  }
`

const NoneFound = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderRadius: "8px",
  padding: "16px",
  paddingBottom: "24px",
  boxShadow:
    "1px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)",
}))

const PAGE_SIZE = 20
const MAX_PAGE = 50

const getLastPage = (count: number): number => {
  const pages = Math.ceil(count / PAGE_SIZE)
  return pages > MAX_PAGE ? MAX_PAGE : pages
}

/**
 * Sorts by the next start date of a resource's upcoming runs. Nothing without
 * runs -- no learning material -- has one, hence the tabs that declare it
 * unsupported.
 */
const UPCOMING_SORT = "upcoming"

const TABS: TabConfig[] = [
  {
    name: "all",
    label: "All",
    defaultTab: true,
    resource_type_group: null,
    minWidth: 85,
  },
  {
    name: "courses",
    label: "Courses",
    resource_type_group: ResourceTypeGroupEnum.Course,
    minWidth: 112,
  },
  {
    name: "programs",
    label: "Programs",
    resource_type_group: ResourceTypeGroupEnum.Program,
    minWidth: 118,
  },
  {
    name: "learning-materials",
    label: "Learning Materials",
    resource_type_group: ResourceTypeGroupEnum.LearningMaterial,
    minWidth: 172,
    unsupportedSortby: [UPCOMING_SORT],
  },
]

const SORT_OPTIONS = [
  {
    label: "Best Match",
    value: "",
  },
  {
    label: "Recently Added",
    value: "new",
  },
  {
    label: "Popular",
    value: "-views",
  },
  {
    label: "Upcoming",
    value: UPCOMING_SORT,
  },
]

const searchModeDropdownOptions = Object.entries(
  SearchModeEnumDescriptions,
).map(([label, value]) => ({ label, value }))

export interface SearchDisplayProps {
  page: number
  setPage: (newPage: number) => void
  onFetchTimeChange?: (time: number | null) => void
  facetManifest: FacetManifest
  facetNames: UseResourceSearchParamsProps["facets"]
  constantSearchParams: Facets & BooleanFacets
  hasFacets: UseResourceSearchParamsResult["hasFacets"]
  requestParams: UseResourceSearchParamsResult["params"]
  setParamValue: UseResourceSearchParamsResult["setParamValue"]
  clearAllFacets: UseResourceSearchParamsResult["clearAllFacets"]
  toggleParamValue: UseResourceSearchParamsResult["toggleParamValue"]
  showProfessionalToggle?: boolean
  setSearchParams: UseResourceSearchParamsProps["setSearchParams"]
  resultsHeadingEl: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  filterHeadingEl: React.ElementType
  getQueryOptions?: (
    params: ReturnType<typeof getSearchParams>,
  ) =>
    | ReturnType<typeof learningResourceQueries.search>
    | ReturnType<typeof learningResourceQueries.vectorSearch>
  getDisplayData?: (
    data: LearningResourcesSearchResponse | undefined,
    params: ReturnType<typeof getSearchParams>,
  ) => LearningResourcesSearchResponse | undefined
  hidePagination?: boolean
  /**
   * "cards" is the topic page's layout: no facet sidebar, and results as a
   * grid of compact cards rather than full-width rows. Its facets live in a
   * bar above the results instead, which the caller renders.
   *
   * Defaults to "default", which is every other caller -- the search page and
   * the unit, department and pathway channels are untouched by this.
   */
  resultsLayout?: "default" | "cards"
  adminOptionsSlot?: React.ReactNode
  /**
   * True when this instance queries the vector (hybrid) endpoint rather than
   * OpenSearch. Set by HybridSearchDisplay; the admin panel uses it to hide
   * the OpenSearch-only relevance controls, which the vector endpoint ignores.
   */
  hybridSearchActive?: boolean
}

const SearchDisplay: React.FC<SearchDisplayProps> = ({
  page,
  setPage,
  facetManifest,
  facetNames,
  constantSearchParams,
  hasFacets,
  requestParams,
  setParamValue,
  clearAllFacets: actuallyClearAllFacets,
  toggleParamValue,
  showProfessionalToggle,
  setSearchParams: actuallySetSearchParams,
  resultsHeadingEl,
  filterHeadingEl,
  onFetchTimeChange,
  getQueryOptions,
  getDisplayData,
  hidePagination = false,
  adminOptionsSlot,
  hybridSearchActive = false,
  resultsLayout = "default",
}) => {
  const searchParams = useAppSearchParams()
  const [expandAdminOptions, setExpandAdminOptions] = useState(false)

  // The admin params endpoint supplies defaults for the OpenSearch-only
  // controls, so there is nothing to fetch while hybrid search is active.
  const { data: adminParams, isLoading: isAdminParamsLoading } =
    useAdminSearchParams(expandAdminOptions && !hybridSearchActive)

  const scrollHook = useRef<HTMLDivElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusResultsHeading = useCallback(
    () => resultsHeadingRef.current?.focus(),
    [],
  )
  const activeTab =
    TABS.find(
      (t) => t.resource_type_group === searchParams.get("resource_type_group"),
    ) ??
    TABS.find((t) => t.defaultTab) ??
    TABS[0]

  const allParams = useMemo(() => {
    return getSearchParams({
      searchParams,
      requestParams,
      constantSearchParams,
      resourceTypeGroup: activeTab?.resource_type_group || undefined,
      facetNames,
      page,
      pageSize: PAGE_SIZE,
    })
  }, [
    searchParams,
    requestParams,
    constantSearchParams,
    activeTab?.resource_type_group,
    facetNames,
    page,
  ])
  const offerorsQuery = useOfferorsList()
  const offerors = useMemo(() => {
    return keyBy(offerorsQuery.data?.results ?? [], (o) => o.code)
  }, [offerorsQuery.data?.results])

  const { data: user } = useUserMe()

  const queryOptions =
    getQueryOptions?.(allParams) ??
    learningResourceQueries.search(allParams as LRSearchRequest)

  const { data, isLoading, isFetching } = useQuery({
    ...(queryOptions as ReturnType<typeof learningResourceQueries.search>),
    placeholderData: keepPreviousData,
    select: (timedData: {
      result: LearningResourcesSearchResponse
      time: number
    }) => {
      const { result: data, time } = timedData as {
        result: LearningResourcesSearchResponse
        time: number
      }

      // Handle missing data gracefully
      if (
        !data?.metadata?.aggregations?.offered_by ||
        !data?.results ||
        data.results.length === 0
      ) {
        return { ...data, time }
      }

      // only show offerors with display_facet set
      const displayOfferors = Object.values(offerors)
        .filter((value) => value.code && value.display_facet)
        .map((value) => value?.code)

      return {
        ...data,
        time,
        metadata: {
          ...data.metadata,
          aggregations: {
            ...data.metadata.aggregations,
            offered_by: data.metadata.aggregations.offered_by.filter(
              (value) => value && displayOfferors.includes(value.key),
            ),
          },
        },
      }
    },
  })

  const displayData = useMemo(
    () => getDisplayData?.(data, allParams) ?? data,
    [allParams, data, getDisplayData],
  )

  useEffect(() => {
    if (onFetchTimeChange) {
      onFetchTimeChange(data?.time ?? null)
    }
  }, [data?.time, onFetchTimeChange])

  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false)

  const toggleMobileDrawer = (newOpen: boolean) => () => {
    setMobileDrawerOpen(newOpen)
  }

  /**
   * The facet setters arrive already reporting what they change -- a page
   * wraps them once and hands the same pair to every control it draws, so a
   * second filter bar beside these facets reports the same way they do. The
   * two below stay here: they have no second caller, and `setSearchParams`
   * takes a name this component supplies rather than one the page knows.
   */
  const { captureFilterEvent } = useTrackedFilterSetters({
    setParamValue,
    toggleParamValue,
  })

  const clearAllFacets = () => {
    actuallyClearAllFacets()
    captureFilterEvent("clear_all")
  }

  const setSearchParams = (
    name: string,
    value: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  ) => {
    actuallySetSearchParams(value)
    captureFilterEvent(name)
  }

  // Kept in the list rather than removed, so a sortby that arrives in the URL
  // still has a label to render.
  const sortOptions = SORT_OPTIONS.map((option) =>
    activeTab.unsupportedSortby?.includes(option.value)
      ? { ...option, disabled: true }
      : option,
  )

  const sortDropdown = (
    <SimpleSelect
      size="small"
      value={requestParams.sortby || ""}
      onChange={(e) => setParamValue("sortby", e.target.value)}
      options={sortOptions}
      className="sort-dropdown"
      renderValue={(value) => {
        const opt = SORT_OPTIONS.find((option) => option.value === value)
        return `Sort by: ${opt?.label}`
      }}
    />
  )

  type adminParamsType = {
    search_mode: string
    slop: number
    yearly_decay_percent: number
    min_score: number
    max_incompleteness_penalty: number
    content_file_score_weight: number
    show_ocw_files: boolean
  }

  const AdminOptions = (
    expandAdminOptions: boolean,
    setExpandAdminOptions: (value: boolean) => void,
    adminParams: adminParamsType | void | undefined,
  ) => {
    const searchModeDropdown = (
      <SimpleSelect
        size="small"
        value={searchParams.get("search_mode") || adminParams?.search_mode}
        onChange={(e) =>
          setSearchParams("search_mode", (prev) => {
            const next = new URLSearchParams(prev)
            next.set("search_mode", e.target.value as string)
            if (e.target.value !== "phrase") {
              next.delete("slop")
            }
            return next
          })
        }
        options={searchModeDropdownOptions}
        className="search-mode-dropdown"
      />
    )

    return (
      <div
        className={`facets admin-facet base-facet${expandAdminOptions ? " facets-expanded" : ""}`}
      >
        <button
          className="filter-section-button"
          type="button"
          aria-expanded={expandAdminOptions ? "true" : "false"}
          onClick={() => setExpandAdminOptions(!expandAdminOptions)}
        >
          Admin Options
          <i aria-hidden="true">
            {expandAdminOptions ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
          </i>
        </button>
        {expandAdminOptions ? (
          <div>
            {adminOptionsSlot}
            {hybridSearchActive ? (
              <>
                <VectorAdminOptions setSearchParams={setSearchParams} />
                <ExplanationContainer data-testid="opensearch-only-notice">
                  The controls above tune hybrid search. The remaining relevance
                  controls (search mode, slop, content file weight and OCW
                  files, plus the percent-based staleness, minimum score and
                  incompleteness settings) apply to the OpenSearch endpoint
                  only, so they are hidden here rather than shown with no
                  effect. Switch back to OpenSearch with vector_search=false to
                  tune them.
                </ExplanationContainer>
              </>
            ) : adminParams && !isAdminParamsLoading ? (
              <>
                <AdminTitleContainer>
                  Resource Score Staleness Penalty
                </AdminTitleContainer>
                <SliderInput
                  currentValue={
                    searchParams.get("yearly_decay_percent")
                      ? Number(searchParams.get("yearly_decay_percent"))
                      : adminParams.yearly_decay_percent
                  }
                  setSearchParams={setSearchParams}
                  urlParam="yearly_decay_percent"
                  label="Resource Score Staleness Penalty"
                  min={0}
                  max={10}
                  step={0.2}
                />
                <ExplanationContainer>
                  Relevance score penalty percent per year for resources without
                  upcoming runs. Only affects results if there is a search term.
                </ExplanationContainer>
                <div>
                  <AdminTitleContainer>Search Mode</AdminTitleContainer>
                  <SearchModeDropdownContainer>
                    {searchModeDropdown}
                  </SearchModeDropdownContainer>
                  <ExplanationContainer>
                    OpenSearch search multi-match query type.
                  </ExplanationContainer>
                </div>
                {(!searchParams.get("search_mode") &&
                  adminParams.search_mode === "phrase") ||
                searchParams.get("search_mode") === "phrase" ? (
                  <div>
                    <AdminTitleContainer>Slop</AdminTitleContainer>

                    <SliderInput
                      currentValue={
                        searchParams.get("slop")
                          ? Number(searchParams.get("slop"))
                          : adminParams.slop
                      }
                      setSearchParams={setSearchParams}
                      urlParam="slop"
                      label="Slop"
                      min={0}
                      max={20}
                      step={1}
                    />
                    <ExplanationContainer>
                      The number of words permitted between search terms for
                      multi-word searches. Only used if search mode is set to
                      "phrase".
                    </ExplanationContainer>
                  </div>
                ) : null}
                <AdminTitleContainer>Minimum Score Cutoff</AdminTitleContainer>
                <SliderInput
                  currentValue={
                    searchParams.get("min_score")
                      ? Number(searchParams.get("min_score"))
                      : adminParams.min_score
                  }
                  setSearchParams={setSearchParams}
                  urlParam="min_score"
                  label="Minimum Score Cutoff"
                  min={0}
                  max={20}
                  step={0.5}
                />
                <ExplanationContainer>
                  Minimum relevance score for a search result to be displayed.
                  Only affects results if there is a search term.
                </ExplanationContainer>
                <AdminTitleContainer>
                  Maximum Incompleteness Penalty
                </AdminTitleContainer>
                <SliderInput
                  currentValue={
                    searchParams.get("max_incompleteness_penalty")
                      ? Number(searchParams.get("max_incompleteness_penalty"))
                      : adminParams.max_incompleteness_penalty
                  }
                  setSearchParams={setSearchParams}
                  urlParam="max_incompleteness_penalty"
                  label="Maximum Incompleteness Penalty"
                  min={0}
                  max={100}
                  step={1}
                />
                <ExplanationContainer>
                  Maximum score penalty for incomplete OCW courses in percent.
                  An OCW course with completeness = 0 will have this score
                  penalty. Partially complete courses have a linear penalty
                  proportional to the degree of incompleteness. Only affects
                  results if there is a search term.
                </ExplanationContainer>
                <AdminTitleContainer>
                  Content File Score Weight Adjustment
                </AdminTitleContainer>
                <SliderInput
                  currentValue={
                    searchParams.get("content_file_score_weight")
                      ? Number(searchParams.get("content_file_score_weight"))
                      : adminParams.content_file_score_weight
                  }
                  setSearchParams={setSearchParams}
                  urlParam="content_file_score_weight"
                  label="Content File Score Weight Adjustment"
                  min={0}
                  max={1}
                  step={0.1}
                />
                <ExplanationContainer>
                  Score weight adjustment for content file matches. 1 means no
                  adjustment. 0 means content file matches are not counted in
                  the score. Only affects the results if there is a search term.
                </ExplanationContainer>
                <AdminTitleContainer>Show OCW Files</AdminTitleContainer>
                <Checkbox
                  // smoot-design's Checkbox renders a bare input unless given
                  // `label`; it does not forward aria-label.
                  label="Show OCW files"
                  checked={
                    searchParams.get("show_ocw_files")
                      ? searchParams.get("show_ocw_files") === "true"
                      : (adminParams?.show_ocw_files ?? false)
                  }
                  onChange={(e) =>
                    setSearchParams("show_ocw_files", (prev) => {
                      const next = new URLSearchParams(prev)
                      if (e.target.checked) {
                        next.set("show_ocw_files", "true")
                      } else {
                        next.delete("show_ocw_files")
                      }
                      return next
                    })
                  }
                />
                <ExplanationContainer>
                  Toggle to include or exclude OCW files in the search results.
                </ExplanationContainer>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const filterContents = (
    <FacetStyles>
      {showProfessionalToggle && (
        <ProfessionalToggle
          professionalSetting={requestParams.professional}
          setParamValue={setParamValue}
        />
      )}
      <AvailableFacets
        facetManifest={facetManifest}
        activeFacets={requestParams}
        onFacetChange={toggleParamValue}
        facetOptions={displayData?.metadata.aggregations ?? {}}
      />
      {user?.is_learning_path_editor
        ? AdminOptions(expandAdminOptions, setExpandAdminOptions, adminParams)
        : null}
    </FacetStyles>
  )

  return (
    <Container>
      <Grid container columnSpacing="24px" flexDirection="row-reverse">
        <ResourceTypeGroupTabs.Context activeTabName={activeTab.name}>
          <Grid
            component="section"
            size={{ xs: 12, md: resultsLayout === "cards" ? 12 : 9 }}
            sx={{
              display: "flex",
              flexDirection: "column",
              /* The cards layout sets the tab row 24px above the grid, which
                 is what its design specifies. */
              gap: resultsLayout === "cards" ? "24px" : "16px",
            }}
          >
            <VisuallyHidden
              as={resultsHeadingEl}
              ref={resultsHeadingRef}
              tabIndex={-1}
            >
              Search Results
            </VisuallyHidden>
            <VisuallyHidden aria-live="polite" aria-atomic aria-relevant="all">
              {/* This could be just isLoading, except we set keepPreviousData
               * to true
               *
               * Reset to empty string with `aria-relevant="all"` to announce
               * the count when data is loaded even if count is same as previous
               * count.
               */}
              {isFetching || isLoading ? "" : `${displayData?.count} results`}
            </VisuallyHidden>
            <UniversalAIBanner searchParams={searchParams} />
            <Stack direction="row" justifyContent="space-between">
              <StyledResourceTabs
                setSearchParams={setSearchParams}
                tabs={TABS}
                aggregations={displayData?.metadata.aggregations}
                onTabChange={() => setPage(1)}
              />
              <DesktopSortContainer>{sortDropdown}</DesktopSortContainer>
            </Stack>
            <AiSearchOverview
              searchParams={searchParams}
              onDismissed={focusResultsHeading}
            />
            <ResourceTypeGroupTabs.TabPanels tabs={TABS}>
              <MobileFilter>
                {/* The cards layout carries its own filters above the
                    results, so this drawer would offer a second, longer set
                    of them -- including the facets that layout deliberately
                    does not have. Sorting has nowhere else to go on a narrow
                    screen, so it stays. */}
                {resultsLayout === "cards" ? null : (
                  <>
                    <FilterButton
                      size="small"
                      variant="text"
                      startIcon={<RiEqualizerLine />}
                      onClick={toggleMobileDrawer(true)}
                    >
                      Filter
                    </FilterButton>

                    <StyledDrawer
                      anchor="left"
                      open={mobileDrawerOpen}
                      onClose={toggleMobileDrawer(false)}
                    >
                      <MobileFacetsTitleContainer>
                        <div>
                          <div>
                            <Typography component="h2" variant="subtitle3">
                              Filter
                            </Typography>
                          </div>
                        </div>
                        <MobileDrawerCloseButton
                          size="large"
                          variant="text"
                          aria-label="Close"
                          onClick={toggleMobileDrawer(false)}
                        >
                          <RiCloseLine fontSize="inherit" />
                        </MobileDrawerCloseButton>
                      </MobileFacetsTitleContainer>
                      {hasFacets ? (
                        <MobileFacetSearchButtons>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={toggleMobileDrawer(false)}
                          >
                            Apply Filters
                          </Button>
                          <ResetButton size="small" onClick={clearAllFacets}>
                            Clear All
                          </ResetButton>
                        </MobileFacetSearchButtons>
                      ) : null}
                      {filterContents}
                    </StyledDrawer>
                  </>
                )}
                <MobileSortContainer>{sortDropdown}</MobileSortContainer>
              </MobileFilter>
              <StyledResultsContainer fetching={isFetching} inert={isFetching}>
                <div ref={scrollHook} />
                {isLoading ? (
                  /* Skeletons in the shape the results will take, so the page
                     does not rearrange itself from rows into a grid the
                     moment they arrive. */
                  resultsLayout === "cards" ? (
                    <CardGrid data-testid="topic-results-grid">
                      {Array(PAGE_SIZE)
                        .fill(null)
                        .map((a, index) => (
                          <li key={index}>
                            <ResourceCard
                              isLoading={isLoading}
                              parentHeadingEl={resultsHeadingEl}
                            />
                          </li>
                        ))}
                    </CardGrid>
                  ) : (
                    <PlainList itemSpacing={1.5}>
                      {Array(PAGE_SIZE)
                        .fill(null)
                        .map((a, index) => (
                          <li key={index}>
                            <ResourceCard
                              isLoading={isLoading}
                              parentHeadingEl={resultsHeadingEl}
                              list
                            />
                          </li>
                        ))}
                    </PlainList>
                  )
                ) : displayData && (displayData.results?.length ?? 0) > 0 ? (
                  resultsLayout === "cards" ? (
                    <CardGrid data-testid="topic-results-grid">
                      {displayData.results.map((resource: LearningResource) => (
                        <li key={resource.id}>
                          <ResourceCard
                            resource={resource}
                            parentHeadingEl={resultsHeadingEl}
                          />
                        </li>
                      ))}
                    </CardGrid>
                  ) : (
                    <PlainList itemSpacing={1.5}>
                      {displayData.results.map((resource: LearningResource) => (
                        <li key={resource.id}>
                          <ResourceCard
                            resource={resource}
                            parentHeadingEl={resultsHeadingEl}
                            list
                          />
                        </li>
                      ))}
                    </PlainList>
                  )
                ) : (
                  <NoneFound>No results found for your query.</NoneFound>
                )}
              </StyledResultsContainer>
              <PaginationContainer>
                {!hidePagination && (
                  <Pagination
                    count={getLastPage(displayData?.count ?? 0)}
                    page={page}
                    onChange={(_, newPage) => {
                      setPage(newPage)
                      setTimeout(() => {
                        scrollHook.current?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        })
                      }, 0)
                    }}
                    renderItem={(item) => (
                      <PaginationItem
                        slots={{
                          previous: RiArrowLeftLine,
                          next: RiArrowRightLine,
                        }}
                        {...item}
                      />
                    )}
                  />
                )}
              </PaginationContainer>
            </ResourceTypeGroupTabs.TabPanels>
          </Grid>
          {resultsLayout === "cards" ? null : (
            <Grid
              component="section"
              size={{ xs: 12, md: 3 }}
              sx={(theme) => ({
                [theme.breakpoints.down("md")]: {
                  display: "none",
                },
              })}
              data-testid="facets-container"
            >
              <FacetsTitleContainer>
                <FilterTitle>
                  <Typography component={filterHeadingEl} variant="subtitle1">
                    Filter
                  </Typography>
                  <RiEqualizerLine fontSize="medium" />
                </FilterTitle>
                {hasFacets ? (
                  <Button
                    variant="text"
                    color="secondary"
                    size="small"
                    onClick={clearAllFacets}
                  >
                    Clear all
                  </Button>
                ) : null}
              </FacetsTitleContainer>
              {filterContents}
            </Grid>
          )}
        </ResourceTypeGroupTabs.Context>
      </Grid>
    </Container>
  )
}

export default SearchDisplay
