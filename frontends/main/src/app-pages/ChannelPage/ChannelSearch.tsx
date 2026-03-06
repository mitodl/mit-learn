import React, { useCallback, useMemo, useEffect } from "react"
import { ChannelTypeEnum } from "api/v0"
import { useOfferorsList } from "api/hooks/learningResources"
import { useResourceSearchParams } from "@mitodl/course-search-utils"
import type { Facets, BooleanFacets } from "@mitodl/course-search-utils"
import { useSearchParams } from "@mitodl/course-search-utils/next"
import SearchDisplay from "@/page-components/SearchDisplay/SearchDisplay"
import { Container, styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { getFacets } from "./searchRequests"
import { keyBy } from "lodash"

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
}

const ChannelSearch: React.FC<ChannelSearchProps> = ({
  constantSearchParams,
  channelType,
  channelTitle,
}) => {
  const offerorsQuery = useOfferorsList()
  const offerors = useMemo(() => {
    return keyBy(offerorsQuery.data?.results ?? [], (o) => o.code)
  }, [offerorsQuery.data?.results])

  const [searchParams, setSearchParams] = useSearchParams()
  const resourceTypeGroup = searchParams.get("resource_type_group")

  const { facetNames, facetManifest } = useMemo(
    () =>
      getFacets(channelType, offerors, constantSearchParams, resourceTypeGroup),
    [offerors, channelType, constantSearchParams, resourceTypeGroup],
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
    setParamValue,
    clearAllFacets,
    toggleParamValue,
    currentText,
    setCurrentText,
    setCurrentTextAndQuery,
  } = useResourceSearchParams({
    searchParams,
    setSearchParams,
    facets: facetNames,
    onFacetsChange,
  })
  const page = +(searchParams.get("page") ?? "1")

  useEffect(() => {
    setCurrentText(params.q ?? "")
  }, [params, setCurrentText])

  return (
    <section>
      <VisuallyHidden as="h2">Search within {channelTitle}</VisuallyHidden>
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

      <SearchDisplay
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
      />
    </section>
  )
}

export default ChannelSearch
