import React from "react"
import { RiFileCopy2Line } from "@remixicon/react"
import { CourseResourceCertificationTypeCodeEnum, ResourceTypeEnum } from "api"
import type { LearningResource } from "api"
import {
  formattedParentCourseName,
  getBestResourceStartDate,
  getLearningResourcePrices,
  getResourceLanguage,
  isPracticeProblem,
  resourceContentFilesImageSrc,
  showStartAnytime,
} from "ol-utilities"
import { freePanel, startsMetadata } from "../ResourceCardView/ResourceCardView"
import type {
  MetadataItem,
  PricePanel,
  ResourceCardContent,
} from "../ResourceCardView/ResourceCardView"

const getMetadata = (resource: LearningResource): MetadataItem[] => {
  const items: MetadataItem[] = []
  // a problem has no start or format; its size is its parts
  if (isPracticeProblem(resource)) {
    const parts = resource.practice_problem.parts.length
    return parts ? [{ label: "Parts", value: parts }] : []
  }
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

/**
 * Only for resources with `certification`: others may have no type. A
 * certificate of completion reads plainly "Certificate"; other types keep
 * their name ("Professional Certificate").
 */
const certificateType = (resource: LearningResource) =>
  resource.certification_type.code ===
  CourseResourceCertificationTypeCodeEnum.Completion
    ? "Certificate"
    : resource.certification_type.name || "Certificate"

const getPrice = (resource: LearningResource): PricePanel => {
  // a problem is something to practice, not something to buy or enroll in:
  // its card has no price panel
  if (isPracticeProblem(resource)) return { tone: "neutral" }
  const prices = getLearningResourcePrices(resource)
  if (!resource.free) {
    return {
      tone: "dark",
      // A range, a single amount, or "Paid" when no price is nonzero.
      primary: prices.course.display ?? undefined,
      certificate: resource.certification
        ? certificateType(resource)
        : undefined,
    }
  }
  const license = resource.license_cc ? "Open license" : undefined
  if (resource.certification) {
    return freePanel({
      certificate: certificateType(resource),
      certificatePrice: prices.certificate.display ?? undefined,
      license,
    })
  }
  return freePanel({ license })
}

/**
 * What a practice problem without a figure shows in its image's place: the
 * problem set it is from over its topic (or its number).
 */
const getPlaceholderDetails = (
  resource: LearningResource,
): ResourceCardContent["placeholderDetails"] => {
  if (!isPracticeProblem(resource)) return undefined
  const problem = resource.practice_problem
  const value =
    problem.topics[0] || (problem.number ? `Problem ${problem.number}` : "")
  if (!value) return undefined
  return { label: problem.document_title || undefined, value }
}

const learningResourceCardContent = (
  resource: LearningResource,
): ResourceCardContent => ({
  title: resource.title,
  typeLabel: resource.resource_category,
  parentCourseName: formattedParentCourseName(resource) ?? undefined,
  imageSrc: resource.image?.url ?? resourceContentFilesImageSrc(resource),
  placeholderDetails: getPlaceholderDetails(resource),
  placeholderIcon:
    resource.resource_type === ResourceTypeEnum.Document ? (
      <RiFileCopy2Line />
    ) : undefined,
  metadata: getMetadata(resource),
  price: getPrice(resource),
  lang: getResourceLanguage(resource),
})

export { learningResourceCardContent }
