import React from "react"
import {
  Container,
  styled,
  theme,
  Typography,
  Breadcrumbs,
  BannerBackground,
} from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { Permission, useUserHasPermission } from "api/hooks/user"
import { websiteContentCreateView } from "@/common/urls"

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
const NewArticleLink = styled(ButtonLink)`
  display: flex;
  justify-content: end;
`
const InfoContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

interface NewsBannerProps {
  title: string
  description: string
  currentBreadcrumb?: string
  backgroundUrl?: string
  className?: string
}

const NewsBanner: React.FC<NewsBannerProps> = ({
  title,
  description,
  currentBreadcrumb = "MIT News",
  backgroundUrl = DEFAULT_BACKGROUND_IMAGE_URL,
  className,
}) => {
  const isArticleEditor = useUserHasPermission(Permission.ArticleEditor)
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
        <InfoContainer>
          <div>
            <BannerTitle component="h1" variant="h1">
              {title}
            </BannerTitle>
            <BannerDescription variant="body1">{description}</BannerDescription>
          </div>
          {isArticleEditor && (
            <NewArticleLink
              variant="tertiary"
              href={websiteContentCreateView("news")}
            >
              <Typography variant="body1">Add news</Typography>
            </NewArticleLink>
          )}
        </InfoContainer>
      </Container>
    </BannerSection>
  )
}

export { NewsBanner }
