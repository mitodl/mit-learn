import React from "react"
import { RiFileCopy2Line } from "@remixicon/react"
import { ResourceTypeEnum } from "api"
import type { LearningResource } from "api"
import {
  formattedParentCourseName,
  getBestResourceStartDate,
  getLearningResourcePrices,
  getResourceLanguage,
  resourceContentFilesImageSrc,
  showStartAnytime,
} from "ol-utilities"
import {
  freeToAuditPanel,
  startsMetadata,
} from "../ResourceCardView/ResourceCardView"
import type {
  MetadataItem,
  PricePanel,
  ResourceCardContent,
} from "../ResourceCardView/ResourceCardView"

const getMetadata = (resource: LearningResource): MetadataItem[] => {
  const items: MetadataItem[] = []
  if (resource.resource_type === ResourceTypeEnum.LearningPath) {
    items.push({ label: "Items", value: resource.learning_path.item_count })
  }
  items.push(
    ...startsMetadata(
      showStartAnytime(resource),
      getBestResourceStartDate(resource),
    ),
  )
  const format = resource.delivery?.[0]?.name
  if (format) {
    items.push({ label: "Format", value: format })
  }
  return items
}

const getPrice = (resource: LearningResource): PricePanel => {
  const prices = getLearningResourcePrices(resource)
  if (!resource.free) {
    return {
      tone: "dark",
      // A range, a single amount, or "Paid" when no price is nonzero.
      primary: prices.course.display ?? undefined,
      certificate: resource.certification
        ? resource.certification_type.name || "Certificate"
        : undefined,
    }
  }
  const license = resource.license_cc ? "Open license" : undefined
  if (resource.certification) {
    return freeToAuditPanel(prices.certificate.display, license)
  }
  return { tone: "light", primary: "Free", license }
}

const learningResourceCardContent = (
  resource: LearningResource,
): ResourceCardContent => ({
  title: resource.title,
  typeLabel: resource.resource_category,
  parentCourseName: formattedParentCourseName(resource) ?? undefined,
  imageSrc: resource.image?.url ?? resourceContentFilesImageSrc(resource),
  placeholderIcon:
    resource.resource_type === ResourceTypeEnum.Document ? (
      <RiFileCopy2Line />
    ) : undefined,
  metadata: getMetadata(resource),
  price: getPrice(resource),
  lang: getResourceLanguage(resource),
})

export { learningResourceCardContent }
