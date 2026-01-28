import React from "react"
import type { AriaAttributes } from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import { RiAwardFill } from "@remixicon/react"
import { Card } from "../Card/Card"
import type { Size } from "../Card/Card"
import { ActionButton } from "@mitodl/smoot-design"
import type { ActionButtonProps } from "@mitodl/smoot-design"
import { imgConfigs } from "../../constants/imgConfigs"
import { theme } from "../ThemeProvider/ThemeProvider"
import Tooltip from "@mui/material/Tooltip"

const SkeletonImage = styled(Skeleton)<{ aspect: number }>`
  padding-bottom: ${({ aspect }) => 100 / aspect}%;
`

const Label = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const Value = styled.span<{ size?: Size }>(({ theme, size }) => [
  {
    color: theme.custom.colors.darkGray2,
  },
  size === "small" && {
    color: theme.custom.colors.silverGrayDark,
    ".MitCard-root:hover &": {
      color: theme.custom.colors.darkGray2,
    },
  },
])

const getImageDimensions = (size: Size, isMedia: boolean) => {
  const dimensions = {
    small: { width: 190, height: isMedia ? 190 : 120 },
    medium: { width: 298, height: isMedia ? 298 : 170 },
  }
  return dimensions[size]
}

const PriceContainer = styled.div<{ size: Size }>(({ size }) => ({
  display: "flex",
  alignItems: "center",
  gap: size === "small" ? "4px" : "8px",
}))

const Certificate = styled.div<{ size: Size }>`
  padding: ${({ size }) => (size === "small" ? "2px" : "2px 4px")};
  border-radius: 4px;
  color: ${theme.custom.colors.silverGrayDark};
  background-color: ${theme.custom.colors.lightGray1};

  ${{ ...theme.typography.subtitle4 }}
  svg {
    width: 12px;
    height: 12px;
  }

  display: flex;
  align-items: center;
  gap: 4px;
`

const CertificatePrice = styled.div`
  ${{ ...theme.typography.body4 }}
`

export const Price = styled.div`
  ${{ ...theme.typography.subtitle3 }}
  color: ${theme.custom.colors.darkGray2};
`

type ActionButtonInfo = {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  "aria-label": string
  filled?: boolean
  icon: React.ReactNode
}

interface BaseLearningResourceCardProps {
  isLoading?: boolean
  className?: string
  size?: Size
  isMedia?: boolean
  href?: string
  onClick?: React.MouseEventHandler
  headingLevel?: number
  // Display data
  imageSrc?: string
  imageAlt?: string
  title?: string
  resourceType?: string
  coursePrice?: string | null
  certificatePrice?: string | null
  hasCertificate?: boolean
  startLabel?: string
  startDate?: React.ReactNode
  actions?: ActionButtonInfo[]
  lang?: string
  ariaLabel?: string
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

const StyledCard = styled(Card)<{ size: Size } & AriaAttributes>(({ size }) => [
  size === "medium" && {
    ".MitCard-info": {
      height: "18px",
    },
  },
])

const BaseLearningResourceCard: React.FC<BaseLearningResourceCardProps> = ({
  isLoading,
  className,
  size = "medium",
  isMedia = false,
  href,
  onClick,
  headingLevel = 6,
  imageSrc,
  imageAlt = "",
  title,
  resourceType,
  coursePrice,
  certificatePrice,
  hasCertificate,
  startLabel,
  startDate,
  actions = [],
  lang,
  ariaLabel,
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

  const getCertPriceAndLabel = () => {
    if (size === "small") {
      const label = ""
      const hasRange = coursePrice?.includes("–")
      const certPrice = hasRange ? "" : certificatePrice
      return { certificatePrice: certPrice, label }
    }
    const certPrice = certificatePrice
    const label = certPrice ? "Certificate:" : "Certificate"
    return { certificatePrice: certPrice, label }
  }

  const { certificatePrice: certPriceDisplay, label: certLabel } =
    getCertPriceAndLabel()

  return (
    <StyledCard
      as="article"
      aria-label={ariaLabel}
      forwardClicksToLink
      className={className}
      size={size}
      onClick={onClick}
    >
      {imageSrc && (
        <Card.Image
          src={imageSrc}
          alt={imageAlt}
          {...getImageDimensions(size, isMedia)}
        />
      )}
      <Card.Info>
        <>
          {resourceType && <span>{resourceType}</span>}
          <PriceContainer size={size}>
            {hasCertificate && (
              <Certificate size={size}>
                {size === "small" ? (
                  <Tooltip title="Certificate">
                    <RiAwardFill />
                  </Tooltip>
                ) : (
                  <>
                    <RiAwardFill />
                    {certLabel}
                    {certPriceDisplay ? (
                      <CertificatePrice>{certPriceDisplay}</CertificatePrice>
                    ) : null}
                  </>
                )}
              </Certificate>
            )}
            {coursePrice && <Price>{coursePrice}</Price>}
          </PriceContainer>
        </>
      </Card.Info>
      {title && (
        <Card.Title
          href={href}
          lang={lang}
          role="heading"
          aria-level={headingLevel}
        >
          {title}
        </Card.Title>
      )}
      <Card.Actions>
        {actions.map((action, index) => (
          <CardActionButton
            key={index}
            filled={action.filled}
            aria-label={action["aria-label"]}
            onClick={action.onClick}
          >
            {action.icon}
          </CardActionButton>
        ))}
      </Card.Actions>
      <Card.Footer>
        {startDate ? (
          <>
            {startLabel && <Label>{startLabel}</Label>}
            <Value size={size}>{startDate}</Value>
          </>
        ) : null}
      </Card.Footer>
    </StyledCard>
  )
}

export { BaseLearningResourceCard }
export type { BaseLearningResourceCardProps, ActionButtonInfo }
