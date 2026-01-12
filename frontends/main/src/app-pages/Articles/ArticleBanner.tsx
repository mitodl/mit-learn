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
  "/images/backgrounds/background_steps.jpg"

const BannerSection = styled(BannerBackground)`
  padding: 48px 0;
  ${theme.breakpoints.down("sm")} {
    padding: 32px 0;
  }
`

const BannerTitle = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
` as typeof Typography

const BannerDescription = styled(Typography)`
  color: ${theme.custom.colors.white};
  margin-top: 8px;
`

interface ArticleBannerProps {
  title: string
  description: string
  currentBreadcrumb?: string
  backgroundUrl?: string
}

const ArticleBanner: React.FC<ArticleBannerProps> = ({
  title,
  description,
  currentBreadcrumb = "MIT Stories",
  backgroundUrl = DEFAULT_BACKGROUND_IMAGE_URL,
}) => {
  return (
    <BannerSection
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
