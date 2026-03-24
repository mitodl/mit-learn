import React from "react"
import { styled, Container, BannerBackground } from "ol-components"

const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/background_podcast.png"
const DEFAULT_BACKGROUND_IMAGE_MOBILE_URL =
  "/images/backgrounds/background_podcast_mobile.png"

const StyledBannerBackground = styled(BannerBackground)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  padding: "48px 0 64px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0 16px 0",
  },
  [theme.breakpoints.down("sm")]: {
    backgroundImage: `linear-gradient(rgba(0 0 0 / 50%), rgba(0 0 0 / 50%)), url('${DEFAULT_BACKGROUND_IMAGE_MOBILE_URL}')`,
    backgroundAttachment: "scroll",
    backgroundPosition: "center center",
    backgroundSize: "cover",
  },
}))

const BannerForeground = styled.div({
  position: "relative",
  zIndex: 1,
})

const ContentContainer = styled(Container)(({ theme }) => ({
  position: "relative",
  [theme.breakpoints.down("md")]: {
    paddingLeft: "24px",
    paddingRight: "24px",
  },
}))

const BackgroundVector = styled("img")(({ theme }) => ({
  position: "absolute",
  top: 0,
  right: 0,
  width: 325,
  maxWidth: "45%",
  height: "auto",
  pointerEvents: "none",
  zIndex: -99,
  transform: "translate(60%, -15%)",
  [theme.breakpoints.down("md")]: {
    width: 100,
    maxWidth: "55%",
    transform: "none",
  },
  [theme.breakpoints.down("md")]: {
    width: "200px",
    top: "0px",
    right: "100px",
  },
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const BackgroundVectorMobile = styled("img")(({ theme }) => ({
  position: "absolute",
  top: -25,
  right: 10,
  width: "auto",
  height: "auto",
  pointerEvents: "none",
  zIndex: -99,
  display: "none",
  [theme.breakpoints.down("sm")]: {
    display: "block",
  },
}))

const BackgroundCircles = styled("img")(({ theme }) => ({
  position: "absolute",
  bottom: 0,
  left: 0,
  width: 800,
  height: "auto",
  pointerEvents: "none",
  zIndex: 0,
  transform: "translate(-75%, 57%)",
  [theme.breakpoints.down("md")]: {
    width: 320,
  },
}))

interface PodcastBannerBackgroundProps {
  children?: React.ReactNode
}

const PodcastBannerBackground: React.FC<PodcastBannerBackgroundProps> = ({
  children,
}) => {
  return (
    <StyledBannerBackground
      backgroundUrl={DEFAULT_BACKGROUND_IMAGE_URL}
      backgroundDim={50}
    >
      <BannerForeground>
        <ContentContainer>
          <BackgroundVector
            src="/images/Vector.svg"
            alt=""
            aria-hidden="true"
          />
          <BackgroundVectorMobile
            src="/images/rectangle_small.svg"
            alt=""
            aria-hidden="true"
          />
          <BackgroundCircles
            src="/images/circles.svg"
            alt=""
            aria-hidden="true"
          />
          {children}
        </ContentContainer>
      </BannerForeground>
    </StyledBannerBackground>
  )
}

export default PodcastBannerBackground
