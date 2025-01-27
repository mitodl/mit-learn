import React from "react"
import { styled } from "@pigment-css/react"
import Skeleton from "@mui/material/Skeleton"
import {
  RiMenuAddLine,
  RiBookmarkLine,
  RiBookmarkFill,
  RiAwardFill,
} from "@remixicon/react"
import { LearningResource } from "api"
import {
  LocalDate,
  getReadableResourceType,
  DEFAULT_RESOURCE_IMG,
  getLearningResourcePrices,
  getResourceDate,
  showStartAnytime,
} from "ol-utilities"
import { Card } from "../Card/Card"
import type { Size } from "../Card/Card"
import { ActionButton, ActionButtonProps } from "../Button/Button"
import { imgConfigs } from "../../constants/imgConfigs"
import Tooltip from "@mui/material/Tooltip"

const SkeletonImage = styled(Skeleton)<{ aspect: number }>({
  paddingBottom: ({ aspect }) => `${100 / aspect}%`,
})

const Label = styled("span")(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const Value = styled("span")<{ size?: Size }>(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  variants: [
    {
      props: { size: "small" },
      style: {
        color: theme.custom.colors.silverGrayDark,
        ".MitCard-root:hover &": {
          color: theme.custom.colors.darkGray2,
        },
      },
    },
  ],
}))

const getImageDimensions = (size: Size, isMedia: boolean) => {
  const dimensions = {
    small: { width: 190, height: isMedia ? 190 : 120 },
    medium: { width: 298, height: isMedia ? 298 : 170 },
  }
  return dimensions[size]
}

type ResourceIdCallback = (
  event: React.MouseEvent<HTMLButtonElement>,
  resourceId: number,
) => void

const Info = ({
  resource,
  size,
}: {
  resource: LearningResource
  size: Size
}) => {
  const prices = getLearningResourcePrices(resource)
  const certificatePrice =
    size === "small" && prices.certificate.display?.includes("–")
      ? ""
      : prices.certificate.display
        ? prices.certificate.display
        : ""
  const separator = size === "small" ? "" : ": "
  return (
    <>
      <span>{getReadableResourceType(resource.resource_type)}</span>
      <PriceContainer>
        {resource.certification && (
          <Certificate>
            {size === "small" ? (
              <Tooltip title="Certificate">
                <RiAwardFill />
              </Tooltip>
            ) : (
              <RiAwardFill />
            )}
            {size === "small" ? "" : "Certificate"}
            <CertificatePrice>
              {certificatePrice ? `${separator}${certificatePrice}` : ""}
            </CertificatePrice>
          </Certificate>
        )}
        <Price>{prices.course.display}</Price>
      </PriceContainer>
    </>
  )
}

const PriceContainer = styled("div")`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Certificate = styled("div")(({ theme }) => ({
  padding: "2px 4px",
  borderRadius: "4px",
  color: theme.custom.colors.silverGrayDark,
  backgroundColor: theme.custom.colors.lightGray1,

  ...theme.typography.subtitle4,
  svg: {
    width: "12px",
    height: "12px",
  },

  display: "flex",
  alignItems: "center",
  gap: "4px",
}))

const CertificatePrice = styled("div")(({ theme }) => ({
  ...theme.typography.body4,
}))

export const Price = styled("div")(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.darkGray2,
}))

const StartDate: React.FC<{ resource: LearningResource; size?: Size }> = ({
  resource,
  size,
}) => {
  const anytime = showStartAnytime(resource)
  const startDate = getResourceDate(resource)
  const format = size === "small" ? "MMM DD, YYYY" : "MMMM DD, YYYY"
  const formatted = anytime
    ? "Anytime"
    : startDate && <LocalDate date={startDate} format={format} />

  if (!formatted) return null

  const showLabel = size !== "small" || anytime
  return (
    <>
      {showLabel ? <Label>Starts: </Label> : null}
      <Value size={size}>{formatted}</Value>
    </>
  )
}

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
}

const FILLED_PROPS = { variant: "primary" } as const
const UNFILLED_PROPS = { color: "secondary", variant: "secondary" } as const
const CardActionButton: React.FC<
  Pick<ActionButtonProps, "aria-label" | "onClick" | "children"> & {
    filled?: boolean
  }
> = ({ filled, ...props }) => {
  return (
    <ActionButton
      edge="circular"
      size={"small"}
      {...(filled ? FILLED_PROPS : UNFILLED_PROPS)}
      {...props}
    />
  )
}

const StyledCard = styled(Card)<{ size: Size }>({
  variants: [
    {
      props: { size: "medium" },
      style: {
        ".MitCard-info": {
          height: "18px",
        },
      },
    },
  ],
})

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
}) => {
  if (isLoading) {
    const { width, height } = imgConfigs["column"]
    const aspect = isMedia ? 1 : width / height
    return (
      <StyledCard className={className} size={size}>
        <Card.Content>
          <SkeletonImage variant="rectangular" aspect={aspect} />
          <Skeleton height={25} width="65%" sx={{ margin: "23px 16px 0" }} />
          <Skeleton height={25} width="80%" sx={{ margin: "0 16px 35px" }} />
          <Skeleton height={25} width="30%" sx={{ margin: "0 16px 16px" }} />
        </Card.Content>
      </StyledCard>
    )
  }
  if (!resource) {
    return null
  }

  const readableType = getReadableResourceType(resource.resource_type)
  return (
    <StyledCard
      // as="article"
      aria-label={`${readableType}: ${resource.title}`}
      forwardClicksToLink
      className={className}
      size={size}
      onClick={onClick}
    >
      <Card.Image
        src={resource.image?.url ? resource.image?.url : DEFAULT_RESOURCE_IMG}
        alt={resource.image?.alt ?? ""}
        {...getImageDimensions(size, isMedia)}
      />
      <Card.Info>
        <Info resource={resource} size={size} />
      </Card.Info>
      <Card.Title href={href}>{resource.title}</Card.Title>
      <Card.Actions>
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
      </Card.Actions>
      <Card.Footer>
        <StartDate resource={resource} size={size} />
      </Card.Footer>
    </StyledCard>
  )
}

export { LearningResourceCard }
export type { LearningResourceCardProps }
