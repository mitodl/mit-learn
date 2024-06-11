import React from "react"
import styled from "@emotion/styled"

const BANNER_HEIGHT = "200px"
const SM_BANNER_HEIGHT = "115px"
const BACKGROUND_FALLBACK_COLOR = "#000"

interface ImgProps {
  /**
   * The `src` attribute for the banner image.
   */
  src?: string | null
}

/**
 * Prefer direct use of `BannerPage` component.
 */
const BannerPageWrapper = styled.div`
  position: relative;
  width: 100%;
`

interface BannerPageProps extends ImgProps {
  omitBackground?: boolean
  className?: string
  /**
   * Child elements placed below the banner.
   */
  children?: React.ReactNode
  /**
   * Child elements within the banner.
   *
   * By default, the banner content will be vertically centered. Customize this
   * behavior with `bannerContainerClass`.
   */
  bannerContent?: React.ReactNode
  bannerContainerClass?: string
}

const BannerPageHeaderFlex = styled.header`
  min-height: ${BANNER_HEIGHT};
  height: 100%;
  position: relative;
  ${({ theme }) => theme.breakpoints.down("sm")} {
    min-height: ${SM_BANNER_HEIGHT};
  }

  display: flex;
  flex-direction: column;
  justify-content: center;
`

/**
 * Layout a page with a banner at top and content below. Supports optional
 * content with the banner.
 */
const BannerPage: React.FC<BannerPageProps> = ({
  className,
  src,
  bannerContent,
  bannerContainerClass,
  children,
  omitBackground,
  backgroundSize = "cover",
}) => {
  return (
    <BannerPageWrapper className={className}>
      <BannerPageHeaderFlex
        className={bannerContainerClass}
        style={
          !omitBackground
            ? {
                background: `url(${src}) no-repeat top left #000`,
                backgroundAttachment: "local",
                backgroundSize: backgroundSize,
              }
            : { background: BACKGROUND_FALLBACK_COLOR }
        }
      >
        {bannerContent}
      </BannerPageHeaderFlex>
      {children}
    </BannerPageWrapper>
  )
}

export { BannerPage }
