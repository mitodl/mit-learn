import React from "react"
import styled from "@emotion/styled"
import { RiMenuAddLine, RiBookmarkLine, RiBookmarkFill } from "@remixicon/react"
import { ResourceTypeEnum, LearningResource } from "api"
import {
  LocalDate,
  getReadableResourceType,
  DEFAULT_RESOURCE_IMG,
  pluralize,
  getLearningResourcePrices,
  getBestResourceStartDate,
  showStartAnytime,
  getResourceLanguage,
} from "ol-utilities"
import { theme } from "../ThemeProvider/ThemeProvider"
import { BaseLearningResourceCard } from "../BaseLearningResourceCard/BaseLearningResourceCard"
import type { ActionButtonInfo } from "../BaseLearningResourceCard/BaseLearningResourceCard"

export const CardLabel = styled.span`
  color: ${theme.custom.colors.silverGrayDark};
  ${theme.breakpoints.down("sm")} {
    display: none;
  }
`
const CardValue = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

export const Certificate = styled.div`
  border-radius: 4px;
  background-color: ${theme.custom.colors.lightGray1};
  padding: 4px;
  color: ${theme.custom.colors.silverGrayDark};
  gap: 4px;
  margin: 0 16px 0 auto;

  ${{ ...theme.typography.subtitle3 }}

  svg {
    width: 16px;
    height: 16px;
  }

  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.body4 }}
    padding: 2px 4px;
    color: ${theme.custom.colors.darkGray2};
    gap: 2px;

    svg {
      width: 12px;
      height: 12px;
      fill: ${theme.custom.colors.silverGrayDark};
    }

    margin: 0 12px 0 auto;
  }

  display: flex;
  align-items: center;
`

export const Price = styled.div`
  ${{ ...theme.typography.subtitle2 }}
  color: ${theme.custom.colors.darkGray2};
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.subtitle3 }}
  }
`

export const BorderSeparator = styled.div`
  div {
    display: inline;
  }

  div + div {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid ${theme.custom.colors.lightGray2};
  }
`

type ResourceIdCallback = (
  event: React.MouseEvent<HTMLButtonElement>,
  resourceId: number,
) => void

export const Count = ({ resource }: { resource: LearningResource }) => {
  if (resource.resource_type !== ResourceTypeEnum.LearningPath) {
    return null
  }
  const count = resource.learning_path.item_count
  return (
    <div>
      <span>{count}</span> {pluralize("item", count)}
    </div>
  )
}

export const StartDate: React.FC<{ resource: LearningResource }> = ({
  resource,
}) => {
  const anytime = showStartAnytime(resource)
  const startDate = getBestResourceStartDate(resource)
  const formatted = anytime
    ? "Anytime"
    : startDate && <LocalDate date={startDate} format="MMMM DD, YYYY" />
  if (!formatted) return null

  return (
    <div>
      <CardLabel>Starts:</CardLabel> <CardValue>{formatted}</CardValue>
    </div>
  )
}

export const Format = ({ resource }: { resource: LearningResource }) => {
  const format = resource.delivery?.[0]?.name
  if (!format) return null
  return (
    <div>
      <CardLabel>Format:</CardLabel> <CardValue>{format}</CardValue>
    </div>
  )
}

interface LearningResourceListCardProps {
  isLoading?: boolean
  resource?: LearningResource | null
  className?: string
  href?: string
  onAddToLearningPathClick?: ResourceIdCallback | null
  onAddToUserListClick?: ResourceIdCallback | null
  editMenu?: React.ReactNode | null
  inUserList?: boolean
  inLearningPath?: boolean
  draggable?: boolean
  onClick?: React.MouseEventHandler
  headingLevel?: number
}

const LearningResourceListCard: React.FC<LearningResourceListCardProps> = ({
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
    return <BaseLearningResourceCard isLoading className={className} list />
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

export { LearningResourceListCard }
export type { LearningResourceListCardProps }
