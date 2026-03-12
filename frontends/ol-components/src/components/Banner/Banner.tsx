import React from "react"
import styled from "@emotion/styled"
import Typography from "@mui/material/Typography"
import Container from "@mui/material/Container"

const DEFAULT_BACKGROUND_IMAGE_URL = "/images/backgrounds/background_steps.jpg"

const SubHeader = styled(Typography)({
  marginTop: "8px",
  marginBottom: "8px",
})

type BannerBackgroundProps = {
  /**
   * Background image src, url(...), or image-set(...).
   */
  backgroundUrl?: string
  backgroundSize?: string
  backgroundDim?: number
}

const standardizeBackgroundUrl = (url: string) => {
  if (url.startsWith("url(") || url.startsWith("image-set(")) {
    return url
  }
  return url.startsWith("image-set(") ? url : `url('${url}')`
}

/**
 * This is a full-width banner component that takes a background image URL.
 */
const BannerBackground = styled.div<BannerBackgroundProps>(
  ({
    theme,
    backgroundUrl = DEFAULT_BACKGROUND_IMAGE_URL,
    backgroundSize = "cover",
    backgroundDim = 0,
  }) => {
    const backgroundUrlFn = standardizeBackgroundUrl(backgroundUrl)

    return {
      backgroundAttachment: "fixed",
      backgroundImage: backgroundDim
        ? `linear-gradient(rgba(0 0 0 / ${backgroundDim}%), rgba(0 0 0 / ${backgroundDim}%)), ${backgroundUrlFn}`
        : backgroundUrlFn,
      backgroundSize: backgroundSize,
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      color: theme.custom.colors.white,
      padding: "48px 0 48px 0",
      [theme.breakpoints.up("lg")]: {
        backgroundSize:
          backgroundUrl === DEFAULT_BACKGROUND_IMAGE_URL
            ? "140%"
            : backgroundSize,
      },
      [theme.breakpoints.down("sm")]: {
        padding: "32px 0 32px 0",
      },
    }
  },
)

const InnerContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const HeaderContainer = styled.div({
  display: "flex",
  flexDirection: "column",
})

const ActionsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const ActionsContainerDesktop = styled(ActionsContainer)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const ActionsContainerMobile = styled.div(({ theme }) => ({
  paddingTop: "16px",
  paddingBottom: "8px",
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
}))

type BannerProps = BannerBackgroundProps & {
  navText: React.ReactNode
  avatar?: React.ReactNode
  title?: React.ReactNode
  header: React.ReactNode
  subHeader?: React.ReactNode
  extraHeader?: React.ReactNode
  extraActions?: React.ReactNode
}

/**
 * A full-width banner component that supports a background image, title, description,
 * navigation text.
 */
const TYPOGRAPHY_DEFAULTS = {
  defaultHeaderTypography: { xs: "h2", md: "h1" },
  defaultSubHeaderTypography: { xs: "body2", md: "body1" },
}
const Banner = ({
  backgroundUrl = DEFAULT_BACKGROUND_IMAGE_URL,
  backgroundSize = "cover",
  backgroundDim = 0,
  navText,
  avatar,
  title,
  header,
  subHeader,
  extraHeader,
  extraActions,
}: BannerProps) => {
  return (
    <BannerBackground
      backgroundUrl={backgroundUrl}
      backgroundSize={backgroundSize}
      backgroundDim={backgroundDim}
    >
      <Container>
        {navText}
        <InnerContainer>
          <HeaderContainer>
            {avatar ? <div>{avatar}</div> : null}
            <Typography
              component="h1"
              variant="h1"
              typography={TYPOGRAPHY_DEFAULTS.defaultHeaderTypography}
            >
              {title}
            </Typography>
            <ActionsContainerMobile>{extraActions}</ActionsContainerMobile>
            {header && (
              <SubHeader
                variant="body1"
                typography={TYPOGRAPHY_DEFAULTS.defaultSubHeaderTypography}
              >
                {header}
              </SubHeader>
            )}
            {subHeader && (
              <SubHeader
                variant="body1"
                typography={TYPOGRAPHY_DEFAULTS.defaultSubHeaderTypography}
              >
                {subHeader}
              </SubHeader>
            )}
            {extraHeader ? extraHeader : null}
          </HeaderContainer>
          <ActionsContainerDesktop>{extraActions}</ActionsContainerDesktop>
        </InnerContainer>
      </Container>
    </BannerBackground>
  )
}

export { Banner, BannerBackground }
export type { BannerProps, BannerBackgroundProps }
