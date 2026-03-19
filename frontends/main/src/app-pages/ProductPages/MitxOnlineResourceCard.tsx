"use client"

import React from "react"
import { BaseLearningResourceCard } from "ol-components"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"
import { formatPrice, getBestRun, getEnrollmentType } from "@/common/mitxonline"

type CommonCardProps = {
  href: string
  size?: "small" | "medium"
  isLoading?: boolean
  headingLevel?: number
  className?: string
  list?: boolean
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
  | MitxOnlineCourseCardProps
  | MitxOnlineProgramCardProps

const formatResourcePrice = (
  resource: { min_price?: number | null; max_price?: number | null },
  productPrice: string | number | undefined | null,
): string | null => {
  const { min_price: minPrice, max_price: maxPrice } = resource

  if (
    minPrice !== null &&
    minPrice !== undefined &&
    maxPrice !== null &&
    maxPrice !== undefined &&
    minPrice !== maxPrice
  ) {
    return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`
  }

  if (productPrice !== undefined && productPrice !== null) {
    return formatPrice(productPrice)
  }

  const single = minPrice ?? maxPrice
  if (single !== null && single !== undefined) {
    return formatPrice(single)
  }

  return null
}

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
      hasCertificate: Boolean(course.certificate_type),
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
    hasCertificate: Boolean(program.certificate_type),
    certificateTypeName: program.certificate_type || undefined,
    startDate: programStartDate,
    startLabel:
      program.availability === "anytime" ||
      (props.size === "medium" && programStartDate)
        ? "Starts: "
        : undefined,
  }
}

const MitxOnlineResourceCard: React.FC<MitxOnlineResourceCardProps> = (
  props,
) => {
  const {
    href,
    size = "small",
    isLoading,
    headingLevel = 6,
    className,
    list,
  } = props

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
      imageSrc={data.imageSrc}
      imageAlt=""
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
    />
  )
}

export default MitxOnlineResourceCard
export type { MitxOnlineResourceCardProps }
