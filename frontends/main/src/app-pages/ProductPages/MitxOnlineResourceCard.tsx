"use client"

import React from "react"
import { analytics } from "@/common/analytics"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  formatResourcePrice,
  getBestRun,
  getEnrollmentType,
} from "@/common/mitxonline"
import {
  ResourceCardSkeleton,
  ResourceCardView,
  freePanel,
  startsMetadata,
} from "@/page-components/ResourceCardView/ResourceCardView"
import type {
  HeadingLevel,
  PricePanel,
  ResourceCardContent,
} from "@/page-components/ResourceCardView/ResourceCardView"

type CommonCardProps = {
  href: string
  isLoading?: boolean
  headingLevel?: HeadingLevel
  className?: string
  /** The analytics label for clicks. */
  label?: string
}

type MitxOnlineCourseCardProps = CommonCardProps & {
  resource?: CourseWithCourseRunsSerializerV2
  resourceType: "course"
}

type MitxOnlineProgramCardProps = CommonCardProps & {
  resource?: V2ProgramDetail
  resourceType: "program"
}

type MitxOnlineResourceCardProps =
  MitxOnlineCourseCardProps | MitxOnlineProgramCardProps

type CardContentSource =
  | Pick<MitxOnlineCourseCardProps, "resource" | "resourceType">
  | Pick<MitxOnlineProgramCardProps, "resource" | "resourceType">

const getPricePanel = (
  resource: {
    min_price?: number | null
    max_price?: number | null
    certificate_available: boolean
    certificate_type: string
  },
  productPrice: string | number | undefined | null,
  enrollmentModes: Parameters<typeof getEnrollmentType>[0],
): PricePanel => {
  const price = formatResourcePrice(resource, productPrice)
  // A certificate of completion reads plainly "Certificate", like an empty
  // type. MITx Online sends the type as display text, not a code.
  const certificateType =
    !resource.certificate_type ||
    resource.certificate_type === "Certificate of Completion"
      ? "Certificate"
      : resource.certificate_type
  const certificate = resource.certificate_available
    ? certificateType
    : undefined
  switch (getEnrollmentType(enrollmentModes)) {
    case "free":
      return freePanel({ certificate })
    case "paid":
      return { tone: "dark", primary: price ?? "Paid", certificate }
    case "both":
      return freePanel({
        certificate: certificateType,
        certificatePrice: price ?? undefined,
      })
    default:
      return { tone: "neutral", certificate }
  }
}

/** The card's content for a course or program. */
const mitxOnlineCardContent = (
  props: CardContentSource,
): ResourceCardContent | null => {
  if (props.resourceType === "course") {
    const course = props.resource
    if (!course) return null
    const bestRun = getBestRun(course)
    return {
      title: course.title,
      typeLabel: "Course",
      imageSrc: course.page?.feature_image_src || null,
      metadata: startsMetadata(
        course.availability === "anytime",
        bestRun?.start_date,
      ),
      price: getPricePanel(
        course,
        bestRun?.products[0]?.price,
        bestRun?.enrollment_modes,
      ),
    }
  }

  const program = props.resource
  if (!program) return null
  return {
    title: program.title,
    typeLabel:
      program.display_mode === DisplayModeEnum.Course ? "Course" : "Program",
    imageSrc: program.page?.feature_image_src || null,
    metadata: startsMetadata(
      program.availability === "anytime",
      program.start_date,
    ),
    price: getPricePanel(
      program,
      program.products[0]?.price,
      program.enrollment_modes,
    ),
  }
}

const MitxOnlineResourceCard: React.FC<MitxOnlineResourceCardProps> = (
  props,
) => {
  const { href, isLoading, headingLevel = 6, className, label } = props

  if (isLoading) {
    return <ResourceCardSkeleton className={className} layout="responsive" />
  }
  const content = mitxOnlineCardContent(props)
  if (!content) return null
  return (
    <ResourceCardView
      {...content}
      layout="responsive"
      href={href}
      onLinkClick={() =>
        analytics.courseCardClicked({
          label,
          resourceId: props.resource?.id,
          readableId: props.resource?.readable_id,
          resourceType: props.resourceType,
        })
      }
      headingLevel={headingLevel}
      className={className}
    />
  )
}

export default MitxOnlineResourceCard
export { mitxOnlineCardContent }
export type { MitxOnlineResourceCardProps }
