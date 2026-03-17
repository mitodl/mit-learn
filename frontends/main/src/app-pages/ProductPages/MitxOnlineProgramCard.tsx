"use client"

import React from "react"
import { BaseLearningResourceCard } from "ol-components"
import type { V2ProgramDetail } from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { DEFAULT_RESOURCE_IMG } from "ol-utilities"

type MitxOnlineProgramCardProps = {
  program?: V2ProgramDetail
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

const formatProgramPrice = (program: V2ProgramDetail): string | null => {
  const price = program.products[0]?.price
  if (price !== undefined && price !== null) {
    return formatCurrency(Number(price))
  }
  return null
}

const MitxOnlineProgramCard: React.FC<MitxOnlineProgramCardProps> = ({
  program,
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

  if (!program) {
    return null
  }

  const isCourseDisplay = program.display_mode === DisplayModeEnum.Course
  const resourceType = isCourseDisplay ? "Course" : "Program"
  const imageSrc = program.page?.feature_image_src || DEFAULT_RESOURCE_IMG
  const priceText = formatProgramPrice(program)
  const hasCertificate = Boolean(program.certificate_type)

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
      title={program.title}
      resourceType={resourceType}
      coursePrice={coursePrice}
      certificatePrice={certificatePrice}
      hasCertificate={hasCertificate}
      ariaLabel={`${resourceType}: ${program.title}`}
      list={list}
    />
  )
}

export default MitxOnlineProgramCard
