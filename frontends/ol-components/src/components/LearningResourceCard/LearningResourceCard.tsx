import React from "react"
import { RiMenuAddLine, RiBookmarkLine, RiBookmarkFill } from "@remixicon/react"
import { LearningResource } from "api"
import {
  LocalDate,
  getReadableResourceType,
  DEFAULT_RESOURCE_IMG,
  getLearningResourcePrices,
  getBestResourceStartDate,
  showStartAnytime,
  getResourceLanguage,
} from "ol-utilities"
import type { Size } from "../Card/Card"
import { BaseLearningResourceCard } from "../BaseLearningResourceCard/BaseLearningResourceCard"
import type { ActionButtonInfo } from "../BaseLearningResourceCard/BaseLearningResourceCard"
import { LearningResourceListCard } from "./LearningResourceListCard"
import { LearningResourceListCardCondensed } from "./LearningResourceListCardCondensed"

type ResourceIdCallback = (
  event: React.MouseEvent<HTMLButtonElement>,
  resourceId: number,
) => void

interface LearningResourceCardProps {
  isLoading?: boolean
  resource?: LearningResource | null
  className?: string
  size?: Size
  isMedia?: boolean
  href?: string
  onAddToLearningPathClick?: ResourceIdCallback | null
  onAddToUserListClick?: ResourceIdCallback | null
  inUserList?: boolean
  inLearningPath?: boolean
  onClick?: React.MouseEventHandler
  headingLevel?: number
  list?: boolean
  condensed?: boolean
}

const LearningResourceCard: React.FC<LearningResourceCardProps> = ({
  isLoading,
  resource,
  className,
  size = "medium",
  isMedia = false,
  href,
  onAddToLearningPathClick,
  onAddToUserListClick,
  inLearningPath,
  inUserList,
  onClick,
  headingLevel = 6,
  list = false,
  condensed = false,
}) => {
  // Use list card variants if list prop is true
  if (list) {
    if (condensed) {
      return (
        <LearningResourceListCardCondensed
          isLoading={isLoading}
          resource={resource}
          className={className}
          href={href}
          onAddToLearningPathClick={onAddToLearningPathClick}
          onAddToUserListClick={onAddToUserListClick}
          inUserList={inUserList}
          inLearningPath={inLearningPath}
          onClick={onClick}
          headingLevel={headingLevel}
        />
      )
    }
    return (
      <LearningResourceListCard
        isLoading={isLoading}
        resource={resource}
        className={className}
        href={href}
        onAddToLearningPathClick={onAddToLearningPathClick}
        onAddToUserListClick={onAddToUserListClick}
        inUserList={inUserList}
        inLearningPath={inLearningPath}
        onClick={onClick}
        headingLevel={headingLevel}
      />
    )
  }

  if (isLoading) {
    return (
      <BaseLearningResourceCard
        isLoading
        className={className}
        size={size}
        isMedia={isMedia}
        headingLevel={headingLevel}
      />
    )
  }

  if (!resource) {
    return null
  }

  const prices = getLearningResourcePrices(resource)
  const readableType = getReadableResourceType(resource.resource_type)
  const anytime = showStartAnytime(resource)
  const startDate = getBestResourceStartDate(resource)
  const format = size === "small" ? "MMM DD, YYYY" : "MMMM DD, YYYY"
  const formattedDate = anytime
    ? "Anytime"
    : startDate && <LocalDate date={startDate} format={format} />

  const showStartLabel = size !== "small" || anytime
  const startLabel = showStartLabel ? "Starts: " : undefined

  const actions: ActionButtonInfo[] = []

  if (onAddToLearningPathClick) {
    actions.push({
      onClick: (event) => onAddToLearningPathClick(event, resource.id),
      "aria-label": "Add to Learning Path",
      filled: inLearningPath,
      icon: <RiMenuAddLine aria-hidden />,
    })
  }

  if (onAddToUserListClick) {
    actions.push({
      onClick: (event) => onAddToUserListClick(event, resource.id),
      "aria-label": `Bookmark ${readableType}`,
      filled: inUserList,
      icon: inUserList ? (
        <RiBookmarkFill aria-hidden />
      ) : (
        <RiBookmarkLine aria-hidden />
      ),
    })
  }

  return (
    <BaseLearningResourceCard
      className={className}
      size={size}
      isMedia={isMedia}
      href={href}
      onClick={onClick}
      headingLevel={headingLevel}
      imageSrc={resource.image?.url || DEFAULT_RESOURCE_IMG}
      imageAlt={resource.image?.alt ?? ""}
      title={resource.title}
      resourceType={readableType}
      coursePrice={prices.course.display}
      certificatePrice={prices.certificate.display}
      hasCertificate={resource.certification}
      startLabel={startLabel}
      startDate={formattedDate}
      actions={actions}
      lang={getResourceLanguage(resource)}
      ariaLabel={`${readableType}: ${resource.title}`}
    />
  )
}

export { LearningResourceCard }
export type { LearningResourceCardProps }
