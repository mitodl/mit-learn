import React from "react"
import type { AriaAttributes } from "react"
import styled from "@emotion/styled"
import Skeleton from "@mui/material/Skeleton"
import { RiAwardFill } from "@remixicon/react"
import { Card } from "../Card/Card"
import type { Size } from "../Card/Card"
import { ListCard } from "../Card/ListCard"
import { ListCardCondensed } from "../Card/ListCardCondensed"
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
  onClick?: React.MouseEventHandler<HTMLElement>
  headingLevel?: number
  // Display data
  imageSrc?: string
  imageAlt?: string
  title?: string
  resourceType?: string
  coursePrice?: string | null
  certificatePrice?: string | null
  hasCertificate?: boolean
  certificateTypeName?: string
  startLabel?: string
  startDate?: React.ReactNode
  actions?: ActionButtonInfo[]
  lang?: string
  ariaLabel?: string
  list?: boolean
  condensed?: boolean
  footerContent?: React.ReactNode
  draggable?: boolean
  editMenu?: React.ReactNode | null
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

const IMAGE_SIZES = {
  mobile: { width: 116, height: 106 },
  desktop: { width: 236, height: 122 },
}

const ListLoading = styled.div`
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

const MobileListLoading = styled(ListLoading)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
  padding: "0px",
  "> div": {
    padding: "12px",
  },
}))

const DesktopListLoading = styled(ListLoading)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const CondensedLoading = styled.div`
  padding: 16px;
`

const CardLabel = styled.span`
  color: ${theme.custom.colors.silverGrayDark};
  ${theme.breakpoints.down("sm")} {
    display: none;
  }
`

const CardValue = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

const ListCertificate = styled.div`
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

const CertificateTypeName = styled.span(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const CertificateGenericLabel = styled.span(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    display: "none",
  },
}))

const CertificatePriceText = styled.span(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const ListPrice = styled.div`
  ${{ ...theme.typography.subtitle2 }}
  color: ${theme.custom.colors.darkGray2};
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.subtitle3 }}
  }
`

const BorderSeparator = styled.div`
  div {
    display: inline;
  }

  div + div {
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid ${theme.custom.colors.lightGray2};
  }
`

const ListCardActionButton = styled(ActionButton)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    borderStyle: "none",
    width: "24px",
    height: "24px",
    svg: {
      width: "16px",
      height: "16px",
    },
  },
}))

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
  certificateTypeName,
  startLabel,
  startDate,
  actions = [],
  lang,
  ariaLabel,
  list = false,
  condensed = false,
  footerContent,
  draggable = false,
  editMenu = null,
}) => {
  if (isLoading) {
    if (list && condensed) {
      return (
        <ListCardCondensed className={className}>
          <ListCardCondensed.Content>
            <CondensedLoading>
              <Skeleton variant="text" width="6%" />
              <Skeleton
                variant="text"
                width="60%"
                style={{ marginBottom: 8 }}
              />
              <Skeleton variant="text" width="20%" />
            </CondensedLoading>
          </ListCardCondensed.Content>
        </ListCardCondensed>
      )
    }
    if (list) {
      return (
        <ListCard className={className}>
          <ListCard.Content>
            <>
              <MobileListLoading>
                <div>
                  <Skeleton
                    variant="text"
                    width="15%"
                    style={{ marginBottom: 4 }}
                  />
                  <Skeleton
                    variant="text"
                    width="75%"
                    style={{ marginBottom: 16 }}
                  />
                  <Skeleton variant="text" width="20%" />
                </div>
                <Skeleton
                  variant="rectangular"
                  width={IMAGE_SIZES.mobile.width}
                  height={IMAGE_SIZES.mobile.height}
                  style={{ borderRadius: 0 }}
                />
              </MobileListLoading>
              <DesktopListLoading>
                <div>
                  <Skeleton
                    variant="text"
                    width="15%"
                    style={{ marginBottom: 10 }}
                  />
                  <Skeleton
                    variant="text"
                    width="75%"
                    style={{ marginBottom: 51 }}
                  />
                  <Skeleton variant="text" width="20%" />
                </div>
                <Skeleton
                  variant="rectangular"
                  width={IMAGE_SIZES.desktop.width}
                  height={IMAGE_SIZES.desktop.height}
                  style={{ borderRadius: 4 }}
                />
              </DesktopListLoading>
            </>
          </ListCard.Content>
        </ListCard>
      )
    }
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
    const label = certPrice ? "Certificate" : "Certificate"
    return { certificatePrice: certPrice, label }
  }

  const { certificatePrice: certPriceDisplay, label: certLabel } =
    getCertPriceAndLabel()

  // Render list card variant
  if (list && condensed) {
    return (
      <ListCardCondensed
        as="article"
        aria-label={ariaLabel}
        forwardClicksToLink
        className={className}
        onClick={onClick}
        draggable={draggable}
      >
        <ListCardCondensed.Info>
          <>
            {resourceType && <span>{resourceType}</span>}
            {hasCertificate && (
              <ListCertificate>
                <RiAwardFill />
                <CertificateGenericLabel>
                  Certificate{certificatePrice ? ":" : ""}
                </CertificateGenericLabel>
                <CertificateTypeName>
                  {certificateTypeName || "Certificate"}
                  {certificatePrice ? ":" : ""}
                </CertificateTypeName>
                {certificatePrice ? " " : ""}
                {certificatePrice}
              </ListCertificate>
            )}
            {coursePrice && <ListPrice>{coursePrice}</ListPrice>}
          </>
        </ListCardCondensed.Info>
        {title && (
          <ListCardCondensed.Title
            href={href}
            lang={lang}
            role="heading"
            aria-level={headingLevel}
          >
            {title}
          </ListCardCondensed.Title>
        )}
        <ListCardCondensed.Actions>
          {actions.map((action, index) => (
            <ListCardActionButton
              key={index}
              edge="circular"
              size="small"
              {...(action.filled
                ? { variant: "primary" as const }
                : {
                    color: "secondary" as const,
                    variant: "secondary" as const,
                  })}
              aria-label={action["aria-label"]}
              onClick={action.onClick}
            >
              {action.icon}
            </ListCardActionButton>
          ))}
          {editMenu}
        </ListCardCondensed.Actions>
        <ListCardCondensed.Footer>
          {footerContent ? (
            footerContent
          ) : startDate ? (
            <BorderSeparator>
              <div>
                {startLabel && <CardLabel>{startLabel}</CardLabel>}{" "}
                <CardValue>{startDate}</CardValue>
              </div>
            </BorderSeparator>
          ) : null}
        </ListCardCondensed.Footer>
      </ListCardCondensed>
    )
  }

  if (list) {
    return (
      <ListCard
        as="article"
        aria-label={ariaLabel}
        forwardClicksToLink
        className={className}
        onClick={onClick}
        draggable={draggable}
      >
        {imageSrc && (
          <ListCard.Image
            src={imageSrc}
            alt={imageAlt}
            {...IMAGE_SIZES["desktop"]}
          />
        )}
        <ListCard.Info>
          <>
            {resourceType && <span>{resourceType}</span>}
            {hasCertificate && (
              <ListCertificate>
                <RiAwardFill />
                <CertificateGenericLabel>
                  Certificate{certificatePrice ? ":" : ""}
                </CertificateGenericLabel>
                <CertificateTypeName>
                  {certificateTypeName || "Certificate"}
                  {certificatePrice ? ":" : ""}
                </CertificateTypeName>
                <CertificatePriceText>
                  {certificatePrice ? " " : ""}
                  {certificatePrice}
                </CertificatePriceText>
              </ListCertificate>
            )}
            {coursePrice && <ListPrice>{coursePrice}</ListPrice>}
          </>
        </ListCard.Info>
        {title && (
          <ListCard.Title
            href={href}
            lang={lang}
            role="heading"
            aria-level={headingLevel}
          >
            {title}
          </ListCard.Title>
        )}
        <ListCard.Actions>
          {actions.map((action, index) => (
            <ListCard.Action
              key={index}
              edge="circular"
              size="small"
              {...(action.filled
                ? { variant: "primary" as const }
                : {
                    color: "secondary" as const,
                    variant: "secondary" as const,
                  })}
              aria-label={action["aria-label"]}
              onClick={action.onClick}
            >
              {action.icon}
            </ListCard.Action>
          ))}
          {editMenu}
        </ListCard.Actions>
        <ListCard.Footer>
          {footerContent ? (
            footerContent
          ) : startDate ? (
            <BorderSeparator>
              <div>
                {startLabel && <CardLabel>{startLabel}</CardLabel>}{" "}
                <CardValue>{startDate}</CardValue>
              </div>
            </BorderSeparator>
          ) : null}
        </ListCard.Footer>
      </ListCard>
    )
  }

  // Render standard card variant
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
                      <CertificatePrice>: {certPriceDisplay}</CertificatePrice>
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
