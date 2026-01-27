"use client"

import React from "react"
import { Card, Skeleton, styled } from "ol-components"
import type {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { LocalDate, DEFAULT_RESOURCE_IMG } from "ol-utilities"
import { RiAwardFill } from "@remixicon/react"

const Label = styled("span")(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const PriceText = styled("span")(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const InfoRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
}))

const FooterText = styled("span")(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

const Certificate = styled("span")(({ theme }) => ({
  padding: "2px 4px",
  borderRadius: 4,
  color: theme.custom.colors.silverGrayDark,
  backgroundColor: theme.custom.colors.lightGray1,
  display: "flex",
  alignItems: "center",
  gap: 4,
  ...theme.typography.subtitle4,
  svg: {
    width: 12,
    height: 12,
  },
}))

type MitxOnlineCourseCardProps = {
  course?: CourseWithCourseRunsSerializerV2
  href: string
  size?: "small" | "medium"
  isLoading?: boolean
  headingLevel?: number
  className?: string
}

const formatCurrency = (amount: number | null | undefined): string | null => {
  if (amount === null || amount === undefined) {
    return null
  }
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

const formatCoursePrice = (
  course: CourseWithCourseRunsSerializerV2,
): string | null => {
  const { min_price: minPrice, max_price: maxPrice } = course

  if (minPrice === null && maxPrice === null) {
    return null
  }

  if (
    minPrice !== null &&
    maxPrice !== null &&
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice !== maxPrice
  ) {
    const minFormatted = formatCurrency(minPrice)
    const maxFormatted = formatCurrency(maxPrice)
    if (!minFormatted || !maxFormatted) {
      return null
    }
    return `${minFormatted} - ${maxFormatted}`
  }

  const single = minPrice ?? maxPrice
  if (single === null || single === undefined) {
    return null
  }
  return formatCurrency(single)
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
}) => {
  if (isLoading) {
    const height = size === "small" ? 120 : 170
    return (
      <Card className={className} size={size}>
        <Card.Content>
          <Skeleton variant="rectangular" height={height} width="100%" />
          <div style={{ padding: 16 }}>
            <Skeleton height={20} width="60%" />
            <Skeleton height={20} width="80%" />
          </div>
        </Card.Content>
      </Card>
    )
  }

  if (!course) {
    return null
  }

  const startDisplay = getStartDisplay(course)
  const priceText = formatCoursePrice(course)
  const hasCertificate = Boolean(course.certificate_type)
  const imageSrc = course.page.feature_image_src ?? DEFAULT_RESOURCE_IMG

  return (
    <Card
      as="article"
      aria-label={`Course: ${course.title}`}
      forwardClicksToLink
      className={className}
      size={size}
    >
      <Card.Image src={imageSrc} alt="" />
      <Card.Info>
        <InfoRow>
          <Label>Course</Label>
          {priceText ? <PriceText>{priceText}</PriceText> : null}
        </InfoRow>
      </Card.Info>
      <Card.Title href={href} role="heading" aria-level={headingLevel}>
        {course.title}
      </Card.Title>
      <Card.Footer>
        {startDisplay ? (
          <FooterText>
            {course.availability === "anytime" ? (
              <>Starts: Anytime</>
            ) : (
              <>Starts: {startDisplay}</>
            )}
          </FooterText>
        ) : null}
      </Card.Footer>
      <Card.Actions>
        {hasCertificate ? (
          <Certificate aria-label="Certificate available">
            <RiAwardFill aria-hidden />
          </Certificate>
        ) : null}
      </Card.Actions>
    </Card>
  )
}

export default MitxOnlineCourseCard
