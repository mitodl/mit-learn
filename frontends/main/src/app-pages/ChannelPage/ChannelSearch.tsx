import React, { useCallback, useMemo, useEffect } from "react"
import { ChannelTypeEnum } from "api/v0"
import { useOfferorsList } from "api/hooks/learningResources"
import { useResourceSearchParams } from "@mitodl/course-search-utils"
import type { Facets, BooleanFacets } from "@mitodl/course-search-utils"
import { useSetSearchParams } from "@mitodl/course-search-utils/next"
import { useAppSearchParams } from "@/common/useAppSearchParams"
import SearchDisplay from "@/page-components/SearchDisplay/SearchDisplay"
import HybridSearchDisplay from "@/page-components/SearchDisplay/HybridSearchDisplay"
import { Container, styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { getFacets } from "./searchRequests"
import { useHybridSearchEnabled } from "@/common/useHybridSearchEnabled"
import { keyBy } from "lodash"
import TopicSearchFilterBar from "./TopicSearchFilterBar"
import { useTrackedFilterSetters } from "@/common/analytics/searchFilters"

const SearchInputContainer = styled(Container)(({ theme }) => ({
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "40px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "35px",
  },
}))

const StyledSearchField = styled(SearchField)({
  width: "624px",
})

/**
 * The topic layout's filter card, which the design sets 40px above the tabs.
 * Without this the card's white edge runs straight into the white tab row
 * below it and the two read as one block.
 */
const TopicSearchContainer = styled(Container)(({ theme }) => ({
  paddingBottom: "40px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "24px",
  },
}))

const SHOW_PROFESSIONAL_TOGGLE_BY_CHANNEL_TYPE: Record<
  ChannelTypeEnum,
  boolean
> = {
  [ChannelTypeEnum.Topic]: true,
  [ChannelTypeEnum.Department]: false,
  [ChannelTypeEnum.Unit]: false,
  [ChannelTypeEnum.Pathway]: false,
}

interface ChannelSearchProps {
  constantSearchParams: Facets & BooleanFacets
  channelType: ChannelTypeEnum
  channelTitle?: string
  /**
   * "topic" is the topic page's design: the search box and its facets in one
   * card above the results, which are then a grid of cards with no sidebar.
   *
   * Defaults to "default" -- the centred search box and facet sidebar every
   * other channel has, unchanged.
   */
  layout?: "default" | "topic"
}

const ChannelSearch: React.FC<ChannelSearchProps> = ({
  constantSearchParams,
  channelType,
  channelTitle,
  layout = "default",
}) => {
  const offerorsQuery = useOfferorsList()
  const offerors = useMemo(() => {
    return keyBy(offerorsQuery.data?.results ?? [], (o) => o.code)
  }, [offerorsQuery.data?.results])

  const searchParams = useAppSearchParams()
  const setSearchParams = useSetSearchParams()
  const resourceTypeGroup = searchParams.get("resource_type_group")

  const { facetNames, facetManifest } = useMemo(
    () =>
      getFacets(
        channelType,
        offerors,
        constantSearchParams,
        resourceTypeGroup,
        searchParams,
      ),
    [
      offerors,
      channelType,
      constantSearchParams,
      resourceTypeGroup,
      searchParams,
    ],
  )

  const setPage = useCallback(
    (newPage: number) => {
      setSearchParams((current) => {
        const copy = new URLSearchParams(current)
        if (newPage === 1) {
          copy.delete("page")
        } else {
          copy.set("page", newPage.toString())
        }
        return copy
      })
    },
    [setSearchParams],
  )

  const onFacetsChange = useCallback(() => {
    setPage(1)
  }, [setPage])

  const {
    hasFacets,
    params,
    setParamValue: rawSetParamValue,
    clearAllFacets,
    toggleParamValue: rawToggleParamValue,
    currentText,
    setCurrentText,
    setCurrentTextAndQuery,
  } = useResourceSearchParams({
    searchParams,
    setSearchParams,
    facets: facetNames,
    onFacetsChange,
  })

  /**
   * Wrapped once here and handed to both the filter bar and the results
   * display, so a topic channel's two sets of filter controls report the same
   * way. The bar is beside the results rather than inside them, so setters
   * reported from within the display alone would miss everything the bar does.
   */
  const { setParamValue, toggleParamValue, captureFilterEvent } =
    useTrackedFilterSetters({
      setParamValue: rawSetParamValue,
      toggleParamValue: rawToggleParamValue,
    })

  /**
   * Reported here because the bar is the only caller that needs it wrapped.
   * The results display takes the unwrapped `clearAllFacets` and reports its
   * own clear control itself; handing it this one would count every clear
   * from there twice.
   */
  const clearAllFacetsFromBar = () => {
    clearAllFacets()
    captureFilterEvent("clear_all")
  }

  const page = +(searchParams.get("page") ?? "1")

  useEffect(() => {
    setCurrentText(params.q ?? "")
  }, [params, setCurrentText])
  const isHybridSearch = useHybridSearchEnabled()
  const ChannelSearchDisplay = isHybridSearch
    ? HybridSearchDisplay
    : SearchDisplay
  return (
    <section>
      <VisuallyHidden as="h2">Search within {channelTitle}</VisuallyHidden>
      {layout === "topic" ? (
        <TopicSearchContainer>
          <TopicSearchFilterBar
            currentText={currentText}
            setCurrentText={setCurrentText}
            setCurrentTextAndQuery={setCurrentTextAndQuery}
            setPage={setPage}
            params={params}
            setParamValue={setParamValue}
            toggleParamValue={toggleParamValue}
            clearAllFacets={clearAllFacetsFromBar}
          />
        </TopicSearchContainer>
      ) : (
        <SearchInputContainer>
          <StyledSearchField
            value={currentText}
            size="large"
            onChange={(e) => setCurrentText(e.target.value)}
            onSubmit={(e) => {
              setCurrentTextAndQuery(e.target.value)
            }}
            onClear={() => {
              setCurrentTextAndQuery("")
            }}
            setPage={setPage}
          />
        </SearchInputContainer>
      )}

      <ChannelSearchDisplay
        resultsHeadingEl="h3"
        filterHeadingEl="h3"
        page={page}
        setSearchParams={setSearchParams}
        requestParams={params}
        setPage={setPage}
        facetManifest={facetManifest}
        facetNames={facetNames}
        constantSearchParams={constantSearchParams}
        hasFacets={hasFacets}
        setParamValue={setParamValue}
        clearAllFacets={clearAllFacets}
        toggleParamValue={toggleParamValue}
        showProfessionalToggle={
          SHOW_PROFESSIONAL_TOGGLE_BY_CHANNEL_TYPE[channelType]
        }
        resultsLayout={layout === "topic" ? "cards" : "default"}
      />
    </section>
  )
}

export default ChannelSearch
