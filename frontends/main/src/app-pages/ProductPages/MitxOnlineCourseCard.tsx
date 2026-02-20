"use client"

import React from "react"
import { BaseLearningResourceCard } from "ol-components"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"

type MitxOnlineCourseCardProps = {
  course?: CourseWithCourseRunsSerializerV2
  href: string
  size?: "small" | "medium"
  isLoading?: boolean
  headingLevel?: number
  className?: string
  list?: boolean
}

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const formatCoursePrice = (
  course: CourseWithCourseRunsSerializerV2,
): string | null => {
  const { min_price: minPrice, max_price: maxPrice } = course

  if (
    minPrice !== null &&
    minPrice !== undefined &&
    maxPrice !== null &&
    maxPrice !== undefined &&
    minPrice !== maxPrice
  ) {
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
  }

  if (
    course.page?.current_price !== undefined &&
    course.page?.current_price !== null
  ) {
    return formatCurrency(course.page.current_price)
  }

  const single = minPrice ?? maxPrice
  if (single !== null && single !== undefined) {
    return formatCurrency(single)
  }

  return null
}

const getBestRunForCourse = (
  course: CourseWithCourseRunsSerializerV2,
): CourseRunV2 | undefined => {
  const { courseruns } = course
  if (!courseruns || courseruns.length === 0) {
    return undefined
  }

  if (course.next_run_id) {
    const nextRun = courseruns.find((run) => run.id === course.next_run_id)
    if (nextRun) {
      return nextRun
    }
  }
  return courseruns[0]
}

const getStartDisplay = (
  course: CourseWithCourseRunsSerializerV2,
): React.ReactNode => {
  if (course.availability === "anytime") {
    return "Anytime"
  }

  const bestRun = getBestRunForCourse(course)
  if (!bestRun || !bestRun.start_date) {
    return null
  }

  return <LocalDate date={bestRun.start_date} format="MMM DD, YYYY" />
}

const MitxOnlineCourseCard: React.FC<MitxOnlineCourseCardProps> = ({
  course,
  href,
  size = "small",
  isLoading,
  headingLevel = 6,
  className,
  list,
}) => {
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

  if (!course) {
    return null
  }

  const startDisplay = getStartDisplay(course)
  const priceText = formatCoursePrice(course)
  const hasCertificate = Boolean(course.certificate_type)
  const imageSrc = course.page?.feature_image_src ?? DEFAULT_RESOURCE_IMG

  const startLabel =
    course.availability === "anytime" || !startDisplay ? "Starts: " : undefined

  const coursePrice = hasCertificate ? null : priceText
  const certificatePrice = hasCertificate ? priceText : null

  return (
    <BaseLearningResourceCard
      className={className}
      size={size}
      href={href}
      headingLevel={headingLevel}
      imageSrc={imageSrc}
      imageAlt=""
      title={course.title}
      resourceType="Course"
      coursePrice={coursePrice}
      certificatePrice={certificatePrice}
      hasCertificate={hasCertificate}
      startLabel={startLabel}
      startDate={startDisplay}
      ariaLabel={`Course: ${course.title}`}
      list={list}
    />
  )
}

export default MitxOnlineCourseCard
