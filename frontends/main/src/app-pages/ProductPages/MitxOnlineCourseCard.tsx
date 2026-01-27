"use client"

import React from "react"
import { LearningResourceCard } from "ol-components"
import type { LearningResourceCardProps } from "ol-components"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"
import type {
  AvailabilityEnum,
  CourseResource,
  LearningResourcePrice,
  LearningResourceRun,
} from "api"

type MitxOnlineCourseCardProps = {
  course?: CourseWithCourseRunsSerializerV2
  href: string
  size?: "small" | "medium"
  isLoading?: boolean
  headingLevel?: number
  className?: string
}

const buildResourcePrices = (
  course: CourseWithCourseRunsSerializerV2,
): LearningResourcePrice[] => {
  const prices: LearningResourcePrice[] = []
  const { min_price: minPrice, max_price: maxPrice } = course

  if (minPrice !== null && minPrice !== undefined) {
    prices.push({ amount: String(minPrice), currency: "USD" })
  }

  if (maxPrice !== null && maxPrice !== undefined && maxPrice !== minPrice) {
    prices.push({ amount: String(maxPrice), currency: "USD" })
  }

  return prices
}

const mapRunToLearningResourceRun = (
  run: CourseRunV2,
  availability: AvailabilityEnum,
): LearningResourceRun => {
  return {
    id: run.id ?? 0,
    instructors: null,
    image: null,
    level: [],
    delivery: [],
    format: [],
    pace: [],
    resource_prices: [],
    run_id: String(run.id ?? ""),
    title: run.title,
    description: null,
    full_description: null,
    last_modified: null,
    published: run.live,
    languages: null,
    url: run.courseware_url ?? null,
    slug: null,
    semester: null,
    year: null,
    start_date: run.start_date ?? null,
    end_date: run.end_date ?? null,
    enrollment_start: run.enrollment_start ?? null,
    enrollment_end: run.enrollment_end ?? null,
    prices: null,
    checksum: null,
    availability,
    location: undefined,
  }
}

const mapCourseToCourseResource = (
  course: CourseWithCourseRunsSerializerV2,
): CourseResource => {
  const availability: AvailabilityEnum =
    course.availability === "anytime" ? "anytime" : "dated"

  const resourcePrices = buildResourcePrices(course)

  const runs: LearningResourceRun[] = (course.courseruns ?? []).map((run) =>
    mapRunToLearningResourceRun(run, availability),
  )

  const bestRunId =
    course.next_run_id ??
    (course.courseruns && course.courseruns.length > 0
      ? (course.courseruns[0]?.id ?? null)
      : null)

  const imageUrl = course.page?.feature_image_src ?? DEFAULT_RESOURCE_IMG

  const courseResource: CourseResource = {
    id: course.id ?? 0,
    resource_type: "course",
    title: course.title,
    readable_id: course.readable_id,
    description: course.page?.description ?? null,
    full_description: course.page?.description ?? null,
    last_modified: null,
    published: course.page?.live ?? true,
    languages: null,
    url: course.page?.page_url ?? null,
    availability,
    certification: Boolean(course.certificate_type),
    certification_type: {
      code: "none",
      name: "",
    },
    resource_prices: resourcePrices,
    free: (course.min_price ?? course.max_price ?? 0) === 0,
    image: {
      id: 0,
      url: imageUrl,
      alt: null,
      description: null,
    },
    runs,
    best_run_id: bestRunId,
    topics: [],
    position: null,
    offered_by: null,
    platform: null,
    course_feature: null,
    departments: null,
    learning_path_parents: [],
    user_list_parents: [],
    views: 0,
    delivery: [],
    resource_category: "",
    format: [],
    pace: [],
    children: null,
    prices: [],
    ocw_topics: [],
    professional: false,
    next_start_date: null,
    completeness: undefined,
    license_cc: undefined,
    test_mode: undefined,
    continuing_ed_credits: null,
    location: undefined,
    duration: undefined,
    min_weeks: null,
    max_weeks: null,
    time_commitment: undefined,
    min_weekly_hours: null,
    max_weekly_hours: null,
    require_summaries: false,
    course: {
      course_numbers: null,
    },
  }

  return courseResource
}

const MitxOnlineCourseCard: React.FC<MitxOnlineCourseCardProps> = ({
  course,
  href,
  size = "small",
  isLoading,
  headingLevel = 6,
  className,
}) => {
  if (isLoading) {
    return (
      <LearningResourceCard
        isLoading
        size={size as LearningResourceCardProps["size"]}
        className={className}
        headingLevel={headingLevel}
      />
    )
  }

  if (!course) {
    return null
  }

  return (
    <LearningResourceCard
      resource={mapCourseToCourseResource(course)}
      href={href}
      size={size as LearningResourceCardProps["size"]}
      className={className}
      headingLevel={headingLevel}
    />
  )
}

export default MitxOnlineCourseCard
