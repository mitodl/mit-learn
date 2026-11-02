"use client"

import { env } from "@/env"
import React from "react"
import { useFeatureFlagEnabled, usePostHog } from "posthog-js/react"
import { BaseLearningResourceCard } from "ol-components"
import { PostHogEvents } from "@/common/constants"
import { FeatureFlags } from "@/common/feature_flags"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import {
  DEFAULT_RESOURCE_IMG,
  LocalDate,
  useImageWithFallback,
} from "ol-utilities"
import {
  formatResourcePrice,
  getBestRun,
  getEnrollmentType,
} from "@/common/mitxonline"
import {
  ResourceCardSkeleton,
  ResourceCardView,
  freeToAuditPanel,
  startsMetadata,
} from "@/page-components/ResourceCardView/ResourceCardView"
import type {
  HeadingLevel,
  PricePanel,
  ResourceCardContent,
} from "@/page-components/ResourceCardView/ResourceCardView"

type CommonCardProps = {
  href: string
  size?: "small" | "medium"
  isLoading?: boolean
  headingLevel?: HeadingLevel
  className?: string
  list?: boolean
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

type CardData = {
  title: string
  displayType: string
  imageSrc: string
  resourcePrice: string | null
  certificatePrice: string | null
  hasCertificate: boolean
  certificateTypeName: string | undefined
  startDate: React.ReactNode
  startLabel: string | undefined
}

/**
 * Extract and derive all display-relevant fields from a course or program,
 * including enrollment-based price display.
 */
const extractCardData = (
  props: MitxOnlineCourseCardProps | MitxOnlineProgramCardProps,
): CardData | null => {
  const getPrices = (
    resource: { min_price?: number | null; max_price?: number | null },
    productPrice: string | number | undefined | null,
    enrollmentModes: Parameters<typeof getEnrollmentType>[0],
  ) => {
    const price = formatResourcePrice(resource, productPrice)
    switch (getEnrollmentType(enrollmentModes)) {
      case "free":
        return { resourcePrice: "Free", certificatePrice: null }
      case "paid":
        return { resourcePrice: price, certificatePrice: null }
      case "both":
        return { resourcePrice: "Free", certificatePrice: price }
      default:
        return { resourcePrice: null, certificatePrice: null }
    }
  }

  if (props.resourceType === "course") {
    const course = props.resource
    if (!course) return null
    const bestRun = getBestRun(course)
    const startDate =
      course.availability === "anytime" ? (
        "Anytime"
      ) : bestRun?.start_date ? (
        <LocalDate date={bestRun.start_date} format="MMM DD, YYYY" />
      ) : null
    return {
      title: course.title,
      displayType: "Course",
      imageSrc: course.page?.feature_image_src || DEFAULT_RESOURCE_IMG,
      ...getPrices(
        course,
        bestRun?.products[0]?.price,
        bestRun?.enrollment_modes,
      ),
      hasCertificate: course.certificate_available,
      certificateTypeName: course.certificate_type || undefined,
      startDate,
      startLabel:
        course.availability === "anytime" ||
        (props.size === "medium" && startDate)
          ? "Starts: "
          : undefined,
    }
  }

  const program = props.resource
  if (!program) return null
  const isCourseDisplay = program.display_mode === DisplayModeEnum.Course
  const programStartDate =
    program.availability === "anytime" ? (
      "Anytime"
    ) : program.start_date ? (
      <LocalDate date={program.start_date} format="MMM DD, YYYY" />
    ) : null
  return {
    title: program.title,
    displayType: isCourseDisplay ? "Course" : "Program",
    imageSrc: program.page?.feature_image_src || DEFAULT_RESOURCE_IMG,
    ...getPrices(program, program.products[0]?.price, program.enrollment_modes),
    hasCertificate: program.certificate_available,
    certificateTypeName: program.certificate_type || undefined,
    startDate: programStartDate,
    startLabel:
      program.availability === "anytime" ||
      (props.size === "medium" && programStartDate)
        ? "Starts: "
        : undefined,
  }
}

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
      return { tone: "light", primary: "Free", certificate }
    case "paid":
      return { tone: "dark", primary: price ?? "Paid", certificate }
    case "both":
      return freeToAuditPanel(certificateType, price)
    default:
      return { tone: "neutral", certificate }
  }
}

/**
 * The redesigned card's content for a course or program. Unlike
 * `extractCardData`, it is the same at every card size.
 */
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
  const posthog = usePostHog()
  const redesign =
    useFeatureFlagEnabled(FeatureFlags.ResourceCardRedesign) === true
  const {
    href,
    size = "small",
    isLoading,
    headingLevel = 6,
    className,
    list,
    label,
  } = props

  const {
    src: imageSrc,
    unoptimized: imageUnoptimized,
    onError: onImageError,
  } = useImageWithFallback(
    props.resource?.page?.feature_image_src,
    DEFAULT_RESOURCE_IMG,
  )

  const captureClick = () => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(PostHogEvents.CourseCardClicked, {
        label,
        resourceId: props.resource?.id,
        readableId: props.resource?.readable_id,
        resourceType: props.resourceType,
      })
    }
  }

  if (redesign) {
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
        onLinkClick={captureClick}
        headingLevel={headingLevel}
        className={className}
      />
    )
  }

  if (isLoading) {
    return (
      <BaseLearningResourceCard
        isLoading
        size={size}
        className={className}
        headingLevel={headingLevel}
        list={list}
      />
    )
  }

  const data = extractCardData(props)
  if (!data) return null

  return (
    <BaseLearningResourceCard
      className={className}
      size={size}
      href={href}
      headingLevel={headingLevel}
      imageSrc={imageSrc}
      imageAlt=""
      onImageError={onImageError}
      imageUnoptimized={imageUnoptimized}
      title={data.title}
      resourceType={data.displayType}
      resourcePrice={data.resourcePrice}
      certificatePrice={data.certificatePrice}
      hasCertificate={data.hasCertificate}
      certificateTypeName={data.certificateTypeName}
      startLabel={data.startLabel}
      startDate={data.startDate}
      ariaLabel={`${data.displayType}: ${data.title}`}
      list={list}
      onClick={captureClick}
    />
  )
}

export default MitxOnlineResourceCard
export { mitxOnlineCardContent }
export type { MitxOnlineResourceCardProps }
