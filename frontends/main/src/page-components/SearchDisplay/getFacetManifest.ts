import {
  getCertificationTypeName,
  getDepartmentName,
  getLevelName,
} from "@mitodl/course-search-utils"
import type { LearningResourceOfferor } from "api"
import { capitalize } from "ol-utilities"

const LEARNING_MATERIAL = "learning_material"

// Human-readable titles for facets that may be surfaced from the URL.
const EXTRA_FACET_TITLES: Partial<Record<string, string>> = {
  level: "Level",
  platform: "Platform",
  resource_type: "Resource Type",
  course_feature: "Features",
  content_feature_type: "Content Features",
}

// Label functions for facet values that need friendly names.
const EXTRA_FACET_LABEL_FUNCTIONS: Partial<
  Record<string, (key: string) => string>
> = {
  level: (key: string) => getLevelName(key) || key,
  department: (key: string) => getDepartmentName(key) || key,
  certification_type: (key: string) => getCertificationTypeName(key) || key,
}

const titleize = (name: string) =>
  name
    .split("_")
    .map((word) => capitalize(word))
    .join(" ")

const buildExtraFacet = (name: string) => ({
  name,
  title: EXTRA_FACET_TITLES[name] ?? titleize(name),
  type: "filterable",
  expandedOnLoad: true,
  preserveItems: true,
  labelFunction: EXTRA_FACET_LABEL_FUNCTIONS[name] ?? null,
})

export const getFacetManifest = (
  offerors: Record<string, LearningResourceOfferor>,
  resourceTypeGroup: string | null,
  extraFacetNames: string[] = [],
) => {
  const manifest = [
    {
      type: "group",
      name: "free",
      facets: [
        {
          value: true,
          name: "free",
          label: "Free",
        },
      ],
    },
    {
      name: "resource_category",
      title: "Resource Category",
      type: "static",
      expandedOnLoad: true,
      preserveItems: true,
    },
    {
      name: "certification_type",
      title: "Certificate",
      type: "static",
      expandedOnLoad: true,
      preserveItems: true,
      labelFunction: (key: string) => getCertificationTypeName(key) || key,
    },
    {
      name: "topic",
      title: "Topic",
      type: "filterable",
      expandedOnLoad: true,
      preserveItems: true,
    },
    {
      name: "delivery",
      title: "Format",
      type: "static",
      expandedOnLoad: true,
      preserveItems: true,
      labelFunction: (key: string) =>
        key
          .split("_")
          .map((word) => capitalize(word))
          .join("-"),
    },
    {
      name: "offered_by",
      title: "Offered By",
      type: "static",
      expandedOnLoad: false,
      preserveItems: true,
      labelFunction: (key: string) => offerors[key]?.name ?? key,
    },
    {
      name: "department",
      title: "Department",
      type: "filterable",
      expandedOnLoad: false,
      preserveItems: true,
      labelFunction: (key: string) => getDepartmentName(key) || key,
    },
  ]

  //Only display the resource_type facet if the resource_type_group is learning_material
  if (resourceTypeGroup !== LEARNING_MATERIAL) {
    manifest.splice(1, 1)
  }

  // Append any facets present in the URL that aren't shown by default. These
  // render after "Department" (the last default facet) and before Admin Options.
  const existingNames = new Set(manifest.map((facet) => facet.name))
  for (const name of extraFacetNames) {
    if (!existingNames.has(name)) {
      manifest.push(buildExtraFacet(name) as (typeof manifest)[number])
      existingNames.add(name)
    }
  }

  return manifest
}

export default getFacetManifest
