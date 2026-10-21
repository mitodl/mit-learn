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
import { TABS, UPCOMING_SORT, findActiveTab } from "./tabConfigs"
import ProfessionalToggle from "./ProfessionalToggle"
import { useTrackedFilterSetters } from "@/common/analytics/searchFilters"
import SelectedFilters from "./SelectedFilters"
import SliderInput from "./SliderInput"
import VectorAdminOptions from "./VectorAdminOptions"
import { AdminTitleContainer, ExplanationContainer } from "./adminStyles"

import type { TabConfig } from "./tabConfigs"

import { ResourceCard } from "../ResourceCard/ResourceCard"
import { useUserMe } from "api/hooks/user"
import getSearchParams from "./getSearchParams"
import UniversalAIBanner, { BANNER_CLASS } from "./UniversalAIBanner"
import AiSearchOverview from "./AiSearchOverview"

const StyledResourceTabs = styled(ResourceTypeGroupTabs.TabList)`
  margin-top: 0;
`

const DesktopSortContainer = styled.div`
  ${({ theme }) => theme.breakpoints.down("md")} {
    display: none;
  }
`
const MobileSortContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "cards",
})<{ cards: boolean }>(({ theme, cards }) => ({
  float: "right",
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
  /**
   * The cards design's Sort box: 160x40 of white behind the same hairline
   * the Filter button carries, its label at the card's own 12/16 rather
   * than the size the shared select picks. It sits in the row rather than
   * floating out of it, the row being a flex one there.
   */
  ...(cards
    ? {
        float: "none",
        /* The hairline is the shared select's own, and already the
             `silverGrayLight` the design asks for. */
        ".MuiInputBase-root": {
          width: "160px",
          height: "40px",
          borderRadius: "4px",
          backgroundColor: theme.custom.colors.white,
          ...theme.typography.body3,
          color: theme.custom.colors.darkGray2,
        },
        /* 12px of the 160 either side of the label, and 4px between it and
             a 16px chevron -- which is laid over the field rather than in it,
             so the right padding has to clear it. */
        ".MuiSelect-select": {
          padding: "8px 32px 8px 12px",
        },
        ".MuiSelect-icon": {
          width: "16px",
          height: "16px",
          fontSize: "16px",
          right: "12px",
        },
      }
    : {}),
}))

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

    /* A group carries no button to expand it, so it is never the collapsed
       half of that pair: the height set on .facets would simply cut it off,
       as it did the moment one held more than the single row Free has. */
    max-height: none;

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
  /**
   * The results container spaces a list of rows by pushing each item below
   * the one before it. A grid does not want that: `gap` already spaces these
   * both ways, and the margin lands inside the row, so every card but the
   * first in a row sits lower than its neighbours.
   *
   * Doubled to outweigh that rule, which names an ancestor and so starts
   * ahead of anything this can say about its own children.
   */
  "&& > li + li": {
    marginTop: 0,
  },
  /**
   * The card fixes its own width to the one its size is drawn at -- 300px for
   * the medium it is here -- which is the column's width at the design's
   * viewport and no other. Everywhere else the card sat at 300 in a column
   * that was not 300, leaving a gap down the right of every card; on a phone,
   * where the column is the full 343, that gap was the widest of all.
   *
   * The column is the width in a grid, so the cards give that measurement up
   * here. Only the width: the size still decides the type, the date format
   * and whether a start label is drawn at all.
   */
  "> li > *": {
    minWidth: 0,
    maxWidth: "none",
    width: "100%",
  },
}))

/**
 * The topic design's search card: the search box and its facet controls, and
 * nothing else.
 *
 * The tabs and the applied filters are drawn below it rather than in it --
 * the design stands the card on its own, marked out by the red edge down its
 * left side and the low shadow beneath it, and leaves the rows that follow on
 * the page's own grey.
 *
 * Not drawn on a narrow screen: both of the things in it have somewhere else
 * to be there, the search box and the facets alike in the filter drawer.
 */
const TopicSearchCard = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "24px",
  borderRadius: "8px",
  borderLeft: `2px solid ${theme.custom.colors.lightRed}`,
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 3px 2.5px 0 rgba(120, 147, 172, 0.1)",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

/**
 * The tabs, with sorting pushed to the far end of the same row.
 *
 * Below the search card rather than inside it, which is where the design puts
 * them -- and drawn as the shared tab list draws them everywhere else, as
 * pills, white for the one selected and grey for the rest. So there is
 * nothing here but the row: no overrides, because the tab list already
 * matches.
 *
 * Not drawn on a narrow screen, where the same choice is in the filter
 * drawer's checklist and sorting is beside the Filter button.
 */
const TopicTabsRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  "> :last-child": {
    marginLeft: "auto",
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

/**
 * The applied filters, on the page below the tabs.
 *
 * Hidden at the width the card is hidden at, for the same reason: a narrow
 * screen filters from the drawer, and the filters it has applied are shown
 * ticked among the facets there.
 */
const TopicSelectedFilters = styled(SelectedFilters)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const MobileFilter = styled("div", {
  shouldForwardProp: (prop) => prop !== "cards",
})<{ cards: boolean }>(({ theme, cards }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
  color: theme.custom.colors.darkGray2,
  marginTop: "20px",
  marginBottom: "16px",
  /**
   * The cards design puts Filter and Sort on one row, a control at either
   * end. The other layouts float Sort to the right of the same block, which
   * is the same picture by other means -- changed only where the design
   * states it, since the two controls are drawn differently there too.
   */
  ...(cards
    ? {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 0,
      }
    : {}),
}))

/**
 * The button that opens the filter drawer.
 *
 * The cards design draws it as a bordered control to match the Sort box
 * across the row from it -- 40px tall, its label beside a 20px glyph -- where
 * the other layouts draw it as a bare label. `bordered` is the shared variant
 * for that: white on a `silverGrayLight` hairline, which is what the design
 * specifies. Only its label is a shade off, the design setting it in
 * `darkGray1` where the variant leaves it `silverGrayDark`.
 */
const FilterButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "cards",
})<{ cards: boolean }>(({ theme, cards }) =>
  cards
    ? {
        minWidth: 0,
        height: "40px",
        padding: "0 16px",
        borderRadius: "4px",
        gap: "8px",
        color: theme.custom.colors.darkGray1,
        /* The icon slot is sized for the 16px glyph this button's size would
           otherwise carry, and nudged by margins the 8px gap above replaces. */
        "> span": {
          width: "20px",
          height: "20px",
          margin: 0,
        },
        svg: {
          width: "20px",
          height: "20px",
        },
      }
    : {
        marginLeft: "-8px",
        minWidth: 0,
      },
)

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

/** The design's 48px search box, 16px clear of the buttons above it. */
const DrawerSearch = styled.div({
  marginTop: "16px",
  /**
   * The field sizes itself to its own content, which in a drawer leaves it
   * stopping short of the facet boxes below it. The design runs it the full
   * width of the drawer's contents, as they do.
   */
  "> *": {
    width: "100%",
  },
})

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

type Aggregations = NonNullable<
  LearningResourcesSearchResponse["metadata"]["aggregations"]
>

/**
 * The counts a search came back with, less the values it found nothing under.
 *
 * The buckets are the values something matched, but a facet already narrowed
 * by is counted as if it were not -- so its own other values come back with
 * the counts they would have, and a value the rest of the search rules out
 * still comes back at nought. Ticking one of those empties the results, so
 * there is nothing to offer under it.
 *
 * A value already ticked is not dropped here even at nought: `AvailableFacets`
 * puts the active ones back, and the drawer is the only place a filter can be
 * taken off one at a time on a narrow screen, where no chips are drawn.
 */
const withAvailableValues = (aggregations: Aggregations): Aggregations =>
  Object.fromEntries(
    Object.entries(aggregations).map(([name, buckets]) => [
      name,
      (buckets ?? []).filter((bucket) => bucket.doc_count > 0),
    ]),
  )

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
  /**
   * Rendered inside the narrow screen's filter drawer, above the facets.
   *
   * The cards layout draws its search box in the filter card beside the
   * facets, and that card is not drawn on a narrow screen -- so the caller
   * that owns the box hands it over to be drawn here instead, which is where
   * the design has it. Omitted by the default layout, whose search box is
   * above the results at every width.
   */
  drawerSearchSlot?: React.ReactNode
  /**
   * The search box and facets, drawn at the top of the card this renders for
   * the cards layout. The caller owns the search term, so it builds the bar
   * and hands it over rather than this reaching back for the state -- and
   * takes the counts back the other way, since the search that produces them
   * is run here.
   *
   * Undefined until there are counts, which is not the same as counting
   * nothing: a bar that leaves out what the search has nothing under would
   * otherwise leave out everything until the first response.
   */
  filterBarSlot?: (aggregations: Aggregations | undefined) => React.ReactNode
  adminOptionsSlot?: React.ReactNode
  /**
   * True when this instance queries the vector (hybrid) endpoint rather than
   * OpenSearch. Set by HybridSearchDisplay; the admin panel uses it to hide
   * the OpenSearch-only relevance controls, which the vector endpoint ignores.
   */
  hybridSearchActive?: boolean
  /**
   * The resource type tabs above the results. Defaults to Courses, Programs
   * and Learning Materials beside All; the topic page passes `TOPIC_TABS`.
   */
  tabs?: TabConfig[]
}

/** The lift the facet menus carry, so the two read as the same kind of menu. */
const SORT_MENU_PROPS = {
  PaperProps: {
    sx: { boxShadow: "1px 3px 20px 0 rgba(0, 0, 0, 0.12)" },
  },
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
  drawerSearchSlot,
  filterBarSlot,
  adminOptionsSlot,
  hybridSearchActive = false,
  resultsLayout = "default",
  tabs = TABS,
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
  const activeTab = findActiveTab(
    tabs,
    searchParams.getAll("resource_type_group"),
  )

  const allParams = useMemo(() => {
    return getSearchParams({
      searchParams,
      requestParams,
      constantSearchParams,
      resourceTypeGroups: activeTab.resource_type_groups,
      facetNames,
      page,
      pageSize: PAGE_SIZE,
    })
  }, [
    searchParams,
    requestParams,
    constantSearchParams,
    activeTab.resource_type_groups,
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
      aria-label="Sort by"
      /* The lift belongs to the card design, where this menu is one of four
         and has to match the facet menus beside it. The search page and the
         other channels keep the menu they had. */
      MenuProps={resultsLayout === "cards" ? SORT_MENU_PROPS : undefined}
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

  /**
   * The cards layout's drawer takes the resource type choice between the
   * boolean facets and the rest, which is where its design draws it -- under
   * Free, over Format. `AvailableFacets` renders a fragment, so running it
   * over each side of that split is the same markup it would render whole.
   */
  const facetsBeforeTypeChoice = facetManifest.slice(
    0,
    facetManifest.findIndex((facet) => facet.type !== "group"),
  )
  const facetsAfterTypeChoice = facetManifest.slice(
    facetsBeforeTypeChoice.length,
  )
  const aggregations = displayData?.metadata.aggregations ?? {}
  const availableFacets = (manifest: FacetManifest) => (
    <AvailableFacets
      facetManifest={manifest}
      activeFacets={requestParams}
      onFacetChange={toggleParamValue}
      facetOptions={
        resultsLayout === "cards"
          ? withAvailableValues(aggregations)
          : aggregations
      }
    />
  )

  const filterContents = (
    <FacetStyles>
      {showProfessionalToggle && (
        <ProfessionalToggle
          professionalSetting={requestParams.professional}
          setParamValue={setParamValue}
        />
      )}
      {resultsLayout === "cards" ? (
        <>
          {availableFacets(facetsBeforeTypeChoice)}
          <ResourceTypeGroupTabs.Checklist
            tabs={tabs}
            aggregations={displayData?.metadata.aggregations}
            activeTabName={activeTab.name}
            setSearchParams={setSearchParams}
            onTabChange={() => setPage(1)}
          />
          {availableFacets(facetsAfterTypeChoice)}
        </>
      ) : (
        availableFacets(facetManifest)
      )}
      {/* The cards design lists what its drawer holds and stops at the
          facets; the admin panel belongs to the layout that has a sidebar to
          put it in, not to a reader's filter drawer. */}
      {user?.is_learning_path_editor && resultsLayout !== "cards"
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
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              /* The cards design spaces the banner, the search card, the tabs
                 and the applied filters 24px apart. Every other layout keeps
                 the 16px it had. */
              gap: resultsLayout === "cards" ? "24px" : "16px",
              /**
               * This column holds its own contents off the hero above it, and
               * spaces them from each other, so whatever happens to come first
               * sits the same distance down -- the card where the banner draws
               * nothing, the banner where it draws.
               *
               * Which means taking the banner's own margins off: it carries
               * them for the column it has always sat in, which spaces its
               * children more tightly than this one and leaves it to hold
               * itself off what is above and below. Here they would stack with
               * the padding and the gap.
               */
              ...(resultsLayout === "cards"
                ? {
                    paddingTop: "48px",
                    [`.${BANNER_CLASS}`]: { marginTop: 0, marginBottom: 0 },
                    /**
                     * The 8px that makes the results sit 32px below the last
                     * of those rows rather than the 24px between them -- the
                     * design groups the four together and sets the grid
                     * further off than they are off each other.
                     *
                     * On the panel because the panel is what the gap lands
                     * against; above `md` only, because below it the panel
                     * leads with the Filter button, which holds itself off
                     * what is above it already.
                     */
                    [theme.breakpoints.up("md")]: {
                      ".MuiTabPanel-root": { paddingTop: "8px" },
                    },
                  }
                : {}),
            })}
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
            {resultsLayout === "cards" ? (
              <>
                <TopicSearchCard>
                  {filterBarSlot?.(
                    displayData ? withAvailableValues(aggregations) : undefined,
                  )}
                </TopicSearchCard>
                <TopicTabsRow>
                  <StyledResourceTabs
                    setSearchParams={setSearchParams}
                    tabs={tabs}
                    aggregations={displayData?.metadata.aggregations}
                    onTabChange={() => setPage(1)}
                  />
                  <DesktopSortContainer>{sortDropdown}</DesktopSortContainer>
                </TopicTabsRow>
                <TopicSelectedFilters
                  facetManifest={facetManifest}
                  params={requestParams}
                  onRemove={(name, value) => {
                    toggleParamValue(name, value, false)
                    setPage(1)
                  }}
                  onClearAll={() => {
                    clearAllFacets()
                    setPage(1)
                  }}
                  /* The row unmounts with the last filter, so focus moves to
                     the results it was describing. */
                  onEmpty={focusResultsHeading}
                />
              </>
            ) : (
              <Stack direction="row" justifyContent="space-between">
                <StyledResourceTabs
                  setSearchParams={setSearchParams}
                  tabs={tabs}
                  aggregations={displayData?.metadata.aggregations}
                  onTabChange={() => setPage(1)}
                />
                <DesktopSortContainer>{sortDropdown}</DesktopSortContainer>
              </Stack>
            )}
            <AiSearchOverview
              searchParams={searchParams}
              onDismissed={focusResultsHeading}
            />
            <ResourceTypeGroupTabs.TabPanels tabs={tabs}>
              <MobileFilter cards={resultsLayout === "cards"}>
                <FilterButton
                  cards={resultsLayout === "cards"}
                  size={resultsLayout === "cards" ? "medium" : "small"}
                  variant={resultsLayout === "cards" ? "bordered" : "text"}
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
                  {/* `hasFacets` is whether a facet is in the URL, so these
                      otherwise appear only once something is already filtering
                      -- and Apply, which closes the drawer, is most wanted on
                      the way in. The cards design draws both regardless. */}
                  {resultsLayout === "cards" || hasFacets ? (
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
                  {/* The cards layout's search box lives in its filter card,
                      which a narrow screen does not draw -- the design puts it
                      here instead, above the facets it narrows with. */}
                  {drawerSearchSlot ? (
                    <DrawerSearch>{drawerSearchSlot}</DrawerSearch>
                  ) : null}
                  {filterContents}
                </StyledDrawer>
                <MobileSortContainer cards={resultsLayout === "cards"}>
                  {sortDropdown}
                </MobileSortContainer>
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
