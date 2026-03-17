"use client"

import React from "react"
import { BaseLearningResourceCard } from "ol-components"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"
import { getEnrollmentType } from "@/common/mitxonline"

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

/**
 * Get the product price for a course from the next run's product.
 * page.current_price is equivalent (it's the price of the run matching next_run_id).
 */
const getProductPrice = (
  course: CourseWithCourseRunsSerializerV2,
): string | null => {
  const bestRun = getBestRunForCourse(course)
  const runPrice = bestRun?.products[0]?.price
  if (runPrice !== undefined && runPrice !== null) {
    return formatCurrency(Number(runPrice))
  }
  return null
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
  const hasCertificate = Boolean(course.certificate_type)
  const imageSrc = course.page?.feature_image_src || DEFAULT_RESOURCE_IMG

  const startLabel =
    course.availability === "anytime" || !startDisplay ? "Starts: " : undefined

  const bestRun = getBestRunForCourse(course)
  const enrollmentType = getEnrollmentType(bestRun?.enrollment_modes)
  const productPrice = getProductPrice(course)

  let coursePrice: string | null = null
  let certificatePrice: string | null = null

  switch (enrollmentType) {
    case "free":
      coursePrice = "Free"
      break
    case "paid":
      coursePrice = productPrice
      break
    case "both":
      coursePrice = "Free"
      certificatePrice = productPrice
      break
  }

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
