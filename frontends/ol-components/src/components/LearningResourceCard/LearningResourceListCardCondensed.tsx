import React from "react"
import { RiMenuAddLine, RiBookmarkLine, RiBookmarkFill } from "@remixicon/react"
import {
  getReadableResourceType,
  getLearningResourcePrices,
  getResourceLanguage,
  getBestResourceStartDate,
  showStartAnytime,
  LocalDate,
} from "ol-utilities"
import {
  BorderSeparator,
  Count,
  StartDate,
  Format,
} from "./LearningResourceListCard"
import type { LearningResourceListCardProps } from "./LearningResourceListCard"
import { BaseLearningResourceCard } from "../BaseLearningResourceCard/BaseLearningResourceCard"
import type { ActionButtonInfo } from "../BaseLearningResourceCard/BaseLearningResourceCard"

const LearningResourceListCardCondensed: React.FC<
  LearningResourceListCardProps
> = ({
  isLoading,
  resource,
  className,
  href,
  onAddToLearningPathClick,
  onAddToUserListClick,
  editMenu,
  inLearningPath,
  inUserList,
  draggable,
  onClick,
  headingLevel = 6,
}) => {
  if (isLoading) {
    return (
      <BaseLearningResourceCard
        isLoading
        className={className}
        list
        condensed
      />
    )
  }

  if (!resource) {
    return null
  }

  const readableType = getReadableResourceType(resource.resource_type)
  const prices = getLearningResourcePrices(resource)
  const anytime = showStartAnytime(resource)
  const startDate = getBestResourceStartDate(resource)
  const formattedDate = anytime
    ? "Anytime"
    : startDate && <LocalDate date={startDate} format="MMMM DD, YYYY" />

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

  const footerContent = (
    <BorderSeparator>
      <Count resource={resource} />
      <StartDate resource={resource} />
      <Format resource={resource} />
    </BorderSeparator>
  )

  return (
    <BaseLearningResourceCard
      className={className}
      list
      condensed
      href={href}
      onClick={onClick}
      headingLevel={headingLevel}
      title={resource.title}
      resourceType={readableType}
      coursePrice={prices.course.display}
      certificatePrice={prices.certificate.display}
      hasCertificate={resource.certification}
      certificateTypeName={resource.certification_type?.name}
      startLabel="Starts:"
      startDate={formattedDate}
      actions={actions}
      lang={getResourceLanguage(resource)}
      ariaLabel={`${readableType}: ${resource.title}`}
      footerContent={footerContent}
      draggable={draggable}
      editMenu={editMenu}
    />
  )
}

export { LearningResourceListCardCondensed }
export type { LearningResourceListCardProps as LearningResourceListCardCondensedProps }
