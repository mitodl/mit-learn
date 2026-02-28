"use client"

import { keyBy } from "lodash"
import React, { useCallback, useMemo, useEffect } from "react"
import type { FacetManifest } from "@mitodl/course-search-utils"
import { useSearchParams } from "@mitodl/course-search-utils/next"
import { useResourceSearchParams } from "@mitodl/course-search-utils"
import SearchDisplay from "@/page-components/SearchDisplay/SearchDisplay"
import { styled, Container, theme } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { useOfferorsList } from "api/hooks/learningResources"
import { facetNames } from "./searchRequests"
import getFacetManifest from "@/page-components/SearchDisplay/getFacetManifest"
import dynamic from "next/dynamic"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

const cssGradient = `
  linear-gradient(
    to bottom,
    ${theme.custom.colors.lightGray2} 0%,
    ${theme.custom.colors.lightGray1} 165px
  )
`

const Page = styled.div`
  background: ${cssGradient};

  ${({ theme }) => theme.breakpoints.up("md")} {
    background:
      url("/images/search_page_vector.png") no-repeat top left / 35%,
      ${cssGradient};
  }
`

const Header = styled.div`
  height: 165px;

  ${({ theme }) => theme.breakpoints.down("md")} {
    height: 75px;
  }

  display: flex;
  align-items: center;
`

const SearchFieldContainer = styled(Container)({
  display: "flex",
  justifyContent: "center",
})

const StyledSearchField = styled(SearchField)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
  [theme.breakpoints.up("sm")]: {
    width: "570px",
  },
}))

const constantSearchParams = {}

const useFacetManifest = (resourceTypeGroup: string | null) => {
  const offerorsQuery = useOfferorsList()
  const offerors = useMemo(() => {
    return keyBy(offerorsQuery.data?.results ?? [], (o) => o.code)
  }, [offerorsQuery.data?.results])
  const facetManifest = useMemo(
    () => getFacetManifest(offerors, resourceTypeGroup),
    [offerors, resourceTypeGroup],
  )
  return facetManifest
}

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const facetManifest = useFacetManifest(
    searchParams.get("resource_type_group"),
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
    params,
    hasFacets,
    clearAllFacets,
    toggleParamValue,
    currentText,
    setCurrentText,
    setCurrentTextAndQuery,
    setParamValue,
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
    <Page>
      <LearningResourceDrawer />
      <VisuallyHidden>
        <h1>Search</h1>
      </VisuallyHidden>
      <Header>
        <SearchFieldContainer>
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
        </SearchFieldContainer>
      </Header>
      <SearchDisplay
        filterHeadingEl="h2"
        resultsHeadingEl="h2"
        page={page}
        setSearchParams={setSearchParams}
        requestParams={params}
        setPage={setPage}
        facetManifest={facetManifest as FacetManifest}
        facetNames={facetNames}
        constantSearchParams={constantSearchParams}
        hasFacets={hasFacets}
        setParamValue={setParamValue}
        clearAllFacets={clearAllFacets}
        toggleParamValue={toggleParamValue}
        showProfessionalToggle
      />
    </Page>
  )
}

export default SearchPage
