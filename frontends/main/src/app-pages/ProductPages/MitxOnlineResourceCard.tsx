"use client"

import React from "react"
import { BaseLearningResourceCard } from "ol-components"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
  EnrollmentMode,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG, LocalDate } from "ol-utilities"
import { getEnrollmentType } from "@/common/mitxonline"

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
    if (nextRun) return nextRun
  }
  return courseruns[0]
}

const formatPrice = (price: unknown): string | null => {
  if (price === undefined || price === null) return null
  return formatCurrency(Number(price))
}

/**
 * Extract display-relevant fields from a course or program in a uniform shape.
 */
const extractCardData = (
  props: MitxOnlineCourseCardProps | MitxOnlineProgramCardProps,
): {
  title: string
  displayType: string
  imageSrc: string
  productPrice: string | null
  enrollmentModes: EnrollmentMode[] | undefined
  hasCertificate: boolean
  startDate: React.ReactNode
  startLabel: string | undefined
} | null => {
  if (props.resourceType === "course") {
    const course = props.resource
    if (!course) return null
    const bestRun = getBestRunForCourse(course)
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
      productPrice: formatPrice(bestRun?.products[0]?.price),
      enrollmentModes: bestRun?.enrollment_modes,
      hasCertificate: Boolean(course.certificate_type),
      startDate,
      startLabel:
        course.availability === "anytime" || !startDate
          ? "Starts: "
          : undefined,
    }
  }

  const program = props.resource
  if (!program) return null
  const isCourseDisplay = program.display_mode === DisplayModeEnum.Course
  return {
    title: program.title,
    displayType: isCourseDisplay ? "Course" : "Program",
    imageSrc: program.page?.feature_image_src || DEFAULT_RESOURCE_IMG,
    productPrice: formatPrice(program.products[0]?.price),
    enrollmentModes: program.enrollment_modes,
    hasCertificate: Boolean(program.certificate_type),
    startDate: null,
    startLabel: undefined,
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

  const enrollmentType = getEnrollmentType(data.enrollmentModes)

  let coursePrice: string | null = null
  let certificatePrice: string | null = null

  switch (enrollmentType) {
    case "free":
      coursePrice = "Free"
      break
    case "paid":
      coursePrice = data.productPrice
      break
    case "both":
      coursePrice = "Free"
      certificatePrice = data.productPrice
      break
  }

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
      coursePrice={coursePrice}
      certificatePrice={certificatePrice}
      hasCertificate={data.hasCertificate}
      startLabel={data.startLabel}
      startDate={data.startDate}
      ariaLabel={`${data.displayType}: ${data.title}`}
      list={list}
    />
  )
}

export default MitxOnlineResourceCard
export type { MitxOnlineResourceCardProps }
