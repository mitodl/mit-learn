import type {
  Facets,
  FacetKey,
  BooleanFacets,
  FacetManifest,
  UseResourceSearchParamsProps,
} from "@mitodl/course-search-utils"
import { LearningResourceOfferor } from "api"
import { ChannelTypeEnum } from "api/v0"
import { getFacetManifest } from "@/page-components/SearchDisplay/getFacetManifest"
import { getExtraFacetNames } from "@/app-pages/SearchPage/searchRequests"

export const getConstantSearchParams = (searchFilter?: string) => {
  const searchParams: Facets & BooleanFacets = {}

  if (searchFilter) {
    const urlParams = new URLSearchParams(searchFilter)
    for (const [key, value] of urlParams.entries()) {
      const paramEntry = searchParams[key as FacetKey]
      if (paramEntry !== undefined) {
        paramEntry.push(value)
      } else {
        searchParams[key as FacetKey] = [value]
      }
    }
  }

  return searchParams
}

const FACETS_BY_CHANNEL_TYPE: Record<ChannelTypeEnum, string[]> = {
  [ChannelTypeEnum.Topic]: [
    "free",
    "resource_category",
    "resource_type",
    "certification_type",
    "delivery",
    "offered_by",
    "department",
  ],
  [ChannelTypeEnum.Department]: [
    "free",
    "resource_category",
    "resource_type",
    "certification_type",
    "topic",
    "delivery",
    "offered_by",
  ],
  [ChannelTypeEnum.Unit]: [
    "free",
    "resource_category",
    "resource_type",
    "topic",
    "certification_type",
    "delivery",
    "department",
  ],
  [ChannelTypeEnum.Pathway]: [],
}

const getFacetManifestForChannelType = (
  channelType: ChannelTypeEnum,
  offerors: Record<string, LearningResourceOfferor>,
  constantSearchParams: Facets,
  resourceTypeGroup: string | null,
  extraFacetNames: string[] = [],
): FacetManifest => {
  // Facets shown by default for this channel type plus any additional facets
  // present in the URL. Facets hard-coded by the channel config
  // (constantSearchParams) are filtered out below.
  const facets = [
    ...(FACETS_BY_CHANNEL_TYPE[channelType] || []),
    ...extraFacetNames,
  ]
  return getFacetManifest(offerors, resourceTypeGroup, extraFacetNames)
    .filter(
      (facetSetting) =>
        !Object.keys(constantSearchParams).includes(facetSetting.name) &&
        facets.includes(facetSetting.name),
    )
    .sort(
      (a, b) => facets.indexOf(a.name) - facets.indexOf(b.name),
    ) as FacetManifest
}

export const getFacets = (
  channelType: ChannelTypeEnum,
  offerors: Record<string, LearningResourceOfferor>,
  constantSearchParams: Facets,
  resourceTypeGroup: string | null,
  searchParams?: URLSearchParams,
) => {
  // Facets already surfaced by the channel type or pinned by the channel config
  // should not be duplicated as extra facets from the URL.
  const baseFacetNames = [
    ...(FACETS_BY_CHANNEL_TYPE[channelType] || []),
    ...Object.keys(constantSearchParams),
  ] as UseResourceSearchParamsProps["facets"]
  const extraFacetNames = searchParams
    ? (getExtraFacetNames(searchParams, baseFacetNames) ?? [])
    : []

  const facetManifest = getFacetManifestForChannelType(
    channelType,
    offerors,
    constantSearchParams,
    resourceTypeGroup,
    extraFacetNames,
  )

  const facetNames = Array.from(
    new Set(
      facetManifest.flatMap((facet) => {
        if (facet.type === "group") {
          return facet.facets.map((subFacet) => subFacet.name)
        } else {
          return [facet.name]
        }
      }),
    ),
  ) as UseResourceSearchParamsProps["facets"]

  return { facetNames, facetManifest }
}
