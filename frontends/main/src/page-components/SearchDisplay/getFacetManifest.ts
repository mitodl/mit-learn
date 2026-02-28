import {
  getCertificationTypeName,
  getDepartmentName,
} from "@mitodl/course-search-utils"
import type { LearningResourceOfferor } from "api"
import { capitalize } from "ol-utilities"

const LEARNING_MATERIAL = "learning_material"

export const getFacetManifest = (
  offerors: Record<string, LearningResourceOfferor>,
  resourceTypeGroup: string | null,
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
      name: "resource_type",
      title: "Resource Type",
      type: "static",
      expandedOnLoad: true,
      preserveItems: true,
      labelFunction: (key: string) =>
        key
          .split("_")
          .map((word) => capitalize(word))
          .join(" "),
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

  return manifest
}

export default getFacetManifest
