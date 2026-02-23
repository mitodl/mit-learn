import React from "react"
import {
  Container,
  styled,
  theme,
  Typography,
  Breadcrumbs,
  BannerBackground,
} from "ol-components"

export const DEFAULT_BACKGROUND_IMAGE_URL =
  "/images/backgrounds/backgroung_steps.jpg"

const BannerSection = styled(BannerBackground)`
  padding: 48px 0;
  position: relative;
  background-size: 150% !important;
  background-position: center !important;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 85%);
    z-index: 1;
  }

  & > * {
    position: relative;
    z-index: 2;
  }
`

const BannerTitle = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
  ${theme.breakpoints.down("md")} {
    ${{ ...theme.typography.h2 }}
  }
  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.h3 }}
  }
` as typeof Typography

const BannerDescription = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
  ${theme.breakpoints.down("sm")} {
    ${{ ...theme.typography.body2 }}
  }
`

interface ArticleBannerProps {
  title: string
  description: string
  currentBreadcrumb?: string
  backgroundUrl?: string
  className?: string
}

const ArticleBanner: React.FC<ArticleBannerProps> = ({
  title,
  description,
  currentBreadcrumb = "MIT News",
  backgroundUrl = DEFAULT_BACKGROUND_IMAGE_URL,
  className,
}) => {
  return (
    <BannerSection
      className={className}
      backgroundUrl={backgroundUrl}
      backgroundSize="cover"
      backgroundDim={0.4}
    >
      <Container>
        <Breadcrumbs
          variant="dark"
          ancestors={[{ href: "/", label: "Home" }]}
          current={currentBreadcrumb}
        />
        <BannerTitle component="h1" variant="h1">
          {title}
        </BannerTitle>
        <BannerDescription variant="body1">{description}</BannerDescription>
      </Container>
    </BannerSection>
  )
}

export { ArticleBanner }
