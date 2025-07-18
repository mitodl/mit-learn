import React from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import {
  RiMenuAddLine,
  RiBookmarkLine,
  RiAwardFill,
  RiBookmarkFill,
} from "@remixicon/react"
import { ResourceTypeEnum, LearningResource } from "api"
import {
  LocalDate,
  getReadableResourceType,
  DEFAULT_RESOURCE_IMG,
  pluralize,
  getLearningResourcePrices,
  getResourceDate,
  showStartAnytime,
  getResourceLanguage,
} from "ol-utilities"
import { ListCard } from "../Card/ListCard"
import type { ActionButtonProps } from "@mitodl/smoot-design"
import { theme } from "../ThemeProvider/ThemeProvider"

const IMAGE_SIZES = {
  mobile: { width: 116, height: 106 },
  desktop: { width: 236, height: 122 },
}

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

const CertificateText = styled.div`
  display: flex;
`

const CertificatePrice = styled.div`
  ${{ ...theme.typography.body3 }}
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.body4 }}
  }
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

/* This displays a single price for courses with no free option
 * (price includes the certificate). For free courses with the
 * option of a paid certificate, the certificate price displayed
 * in the certificate badge alongside the course "Free" price.
 */
const Info = ({ resource }: { resource: LearningResource }) => {
  const prices = getLearningResourcePrices(resource)
  return (
    <>
      <span>{getReadableResourceType(resource.resource_type)}</span>
      {resource.certification && (
        <Certificate>
          <RiAwardFill />
          <CertificateText>
            {resource.certification_type?.name || "Certificate"}
            <CertificatePrice>
              {prices.certificate.display ? ": " : ""}{" "}
              {prices.certificate.display}
            </CertificatePrice>
          </CertificateText>
        </Certificate>
      )}
      <Price>{prices.course.display}</Price>
    </>
  )
}

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
  const startDate = getResourceDate(resource)
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

const Loading = styled.div`
  display: flex;
  padding: 24px;
  justify-content: space-between;

  > div {
    width: calc(100% - 236px);
  }

  > span {
    flex-grow: 0;
    margin-left: auto;
  }
`

const MobileLoading = styled(Loading)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
  padding: "0px",
  "> div": {
    padding: "12px",
  },
}))

const DesktopLoading = styled(Loading)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const LoadingView = () => {
  return (
    <>
      <MobileLoading>
        <div>
          <Skeleton variant="text" width="15%" style={{ marginBottom: 4 }} />
          <Skeleton variant="text" width="75%" style={{ marginBottom: 16 }} />
          <Skeleton variant="text" width="20%" />
        </div>
        <Skeleton
          variant="rectangular"
          width={IMAGE_SIZES.mobile.width}
          height={IMAGE_SIZES.mobile.height}
          style={{ borderRadius: 0 }}
        />
      </MobileLoading>
      <DesktopLoading>
        <div>
          <Skeleton variant="text" width="15%" style={{ marginBottom: 10 }} />
          <Skeleton variant="text" width="75%" style={{ marginBottom: 51 }} />
          <Skeleton variant="text" width="20%" />
        </div>
        <Skeleton
          variant="rectangular"
          width={IMAGE_SIZES.desktop.width}
          height={IMAGE_SIZES.desktop.height}
          style={{ borderRadius: 4 }}
        />
      </DesktopLoading>
    </>
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
}

type CardActionButtonProps = Pick<
  ActionButtonProps,
  "aria-label" | "onClick" | "children"
> & {
  filled?: boolean
  isMobile?: boolean
}

export const CardActionButton: React.FC<CardActionButtonProps> = ({
  filled,
  isMobile,
  ...props
}) => {
  const FILLED_PROPS = { variant: "primary" } as const
  const UNFILLED_PROPS = { color: "secondary", variant: "secondary" } as const

  return (
    <ListCard.Action
      edge="circular"
      size="small"
      {...(filled ? FILLED_PROPS : UNFILLED_PROPS)}
      {...props}
    />
  )
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
}) => {
  if (isLoading) {
    return (
      <ListCard className={className}>
        <ListCard.Content>
          <LoadingView />
        </ListCard.Content>
      </ListCard>
    )
  }
  if (!resource) {
    return null
  }
  const readableType = getReadableResourceType(resource.resource_type)
  return (
    <ListCard
      as="article"
      aria-label={`${readableType}: ${resource.title}`}
      forwardClicksToLink
      className={className}
      draggable={draggable}
      onClick={onClick}
    >
      <ListCard.Image
        src={resource.image?.url || DEFAULT_RESOURCE_IMG}
        alt={resource.image?.alt ?? ""}
        {...IMAGE_SIZES["desktop"]}
      />
      <ListCard.Info>
        <Info resource={resource} />
      </ListCard.Info>
      <ListCard.Title href={href} lang={getResourceLanguage(resource)}>
        {resource.title}
      </ListCard.Title>
      <ListCard.Actions>
        {onAddToLearningPathClick && (
          <CardActionButton
            filled={inLearningPath}
            aria-label="Add to Learning Path"
            onClick={(event) => onAddToLearningPathClick(event, resource.id)}
          >
            <RiMenuAddLine aria-hidden />
          </CardActionButton>
        )}
        {onAddToUserListClick && (
          <CardActionButton
            filled={inUserList}
            aria-label={`Bookmark ${readableType}`}
            onClick={(event) => onAddToUserListClick(event, resource.id)}
          >
            {inUserList ? (
              <RiBookmarkFill aria-hidden />
            ) : (
              <RiBookmarkLine aria-hidden />
            )}
          </CardActionButton>
        )}
        {editMenu}
      </ListCard.Actions>
      <ListCard.Footer>
        <BorderSeparator>
          <Count resource={resource} />
          <StartDate resource={resource} />
          <Format resource={resource} />
        </BorderSeparator>
      </ListCard.Footer>
    </ListCard>
  )
}

export { LearningResourceListCard }
export type { LearningResourceListCardProps }
