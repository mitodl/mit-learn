"use client"

import React from "react"
import {
  Container,
  Stack,
  Breadcrumbs,
  BannerBackground,
  Typography,
  HEADER_HEIGHT,
} from "ol-components"
import { convertToEmbedUrl } from "@/common/utils"
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { styled } from "@mitodl/smoot-design"
import Image from "next/image"
import type { Breakpoint } from "@mui/system"

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  paddingBottom: "24px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "16px",
  },
}))

const TitleBox = styled(Stack)(({ theme }) => ({
  color: theme.custom.colors.white,
}))
const ProductTag = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGray1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 12px",
  borderRadius: "4px",
  ...theme.typography.subtitle2,
}))

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  paddingBottom: "80px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "24px",
  },
  height: "100%",
}))

const TopContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
  gap: "56px",
})
const BottomContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: "56px",
  flexDirection: "row-reverse",
  paddingTop: "72px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "32px",
    paddingTop: "40px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "40px",
    paddingTop: "24px",
  },
}))

const SHOW_PROPS = new Set(["showAbove", "showBelow", "showBetween"])
/** Responsive visibility helper. Only one of showAbove/showBelow/showBetween should be used. */
const Show = styled("div", {
  shouldForwardProp: (prop) => !SHOW_PROPS.has(prop),
})<{
  showAbove?: Breakpoint
  showBelow?: Breakpoint
  showBetween?: [Breakpoint, Breakpoint]
}>(({ theme, showAbove, showBelow, showBetween }) => ({
  ...(showAbove && {
    [theme.breakpoints.down(showAbove)]: { display: "none" },
  }),
  ...(showBelow && {
    [theme.breakpoints.up(showBelow)]: { display: "none" },
  }),
  ...(showBetween && {
    [theme.breakpoints.down(showBetween[0])]: { display: "none" },
    [theme.breakpoints.up(showBetween[1])]: { display: "none" },
  }),
}))

const MainCol = styled.div({
  width: "100%",
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
})

const SectionsWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "56px",
  [theme.breakpoints.down("md")]: {
    gap: "40px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "32px",
  },
}))

const SidebarCol = styled(Show, {
  shouldForwardProp: (prop) => prop !== "alignSelf",
})<{
  alignSelf?: React.CSSProperties["alignSelf"]
}>(({ alignSelf }) => ({
  width: "100%",
  maxWidth: "410px",
  alignSelf,
}))

/**
 * Pixel distance below header at which the summary box should begin when
 * scrolling.
 */
const OFFSET_FROM_HEADER = 72
/**
 * Column for the summary info box. Unlike SidebarCol, this is always visible.
 * On desktop it acts as a fixed-width sidebar; below md it goes full-width.
 */
const SummaryCol = styled.div(({ theme }) => ({
  width: "100%",
  maxWidth: "410px",
  [theme.breakpoints.up("md")]: {
    position: "sticky",
    // Without this, the flex child stretches to the main column's height
    // and sticky has no room to scroll.
    alignSelf: "flex-start",
    top: `${HEADER_HEIGHT + OFFSET_FROM_HEADER}px`,
  },
  [theme.breakpoints.down("md")]: {
    maxWidth: "none",
  },
}))

const SidebarVideo = styled.iframe(({ theme }) => ({
  borderRadius: "4px",
  border: "none",
  width: "100%",
  maxWidth: "410px",
  aspectRatio: "410 / 230",
  display: "block",
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px 4px 0 0",
  },
}))

const SidebarImage = styled(Image)(({ theme }) => ({
  borderRadius: "4px",
  width: "100%",
  maxWidth: "410px",
  aspectRatio: "410 / 230",
  height: "auto",
  display: "block",
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px 4px 0 0",
  },
}))

const SidebarMedia: React.FC<{
  videoUrl?: string | null
  imageSrc: string
  title: string
  priority?: boolean
}> = ({ videoUrl, imageSrc, title, priority }) => {
  if (videoUrl) {
    const embedUrl = convertToEmbedUrl(videoUrl)
    if (embedUrl) {
      return (
        <SidebarVideo src={embedUrl} title={`${title} video`} allowFullScreen />
      )
    }
  }
  return (
    <SidebarImage
      priority={priority}
      width={410}
      height={230}
      src={imageSrc}
      alt=""
    />
  )
}

type ProductPageTemplateProps = {
  tags: string[]
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  videoUrl?: string | null
  infoBox: React.ReactNode
  children: React.ReactNode
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  tags,
  currentBreadcrumbLabel,
  title,
  shortDescription,
  imageSrc,
  videoUrl,
  infoBox,
  children,
}) => {
  return (
    <Page>
      <BannerBackground backgroundUrl={backgroundSrcSetCSS(backgroundSteps)}>
        <TopContainer data-testid="banner-container">
          <MainCol>
            <StyledBreadcrumbs
              variant="dark"
              ancestors={[{ href: HOME, label: "Home" }]}
              current={currentBreadcrumbLabel}
            />
            <TitleBox alignItems="flex-start" gap="4px">
              <Stack direction="row" gap="8px">
                {tags.map((tag) => {
                  return <ProductTag key={tag}>{tag}</ProductTag>
                })}
              </Stack>
              <Stack alignItems="flex-start" gap="16px">
                <Typography component="h1" typography={{ xs: "h3", sm: "h2" }}>
                  {title}
                </Typography>
                <Typography typography={{ xs: "body2", sm: "body1" }}>
                  {shortDescription}
                </Typography>
              </Stack>
            </TitleBox>
          </MainCol>
          <SidebarCol showAbove="md" alignSelf="flex-end">
            <SidebarMedia
              videoUrl={videoUrl}
              imageSrc={imageSrc}
              title={title}
              priority
            />
          </SidebarCol>
        </TopContainer>
      </BannerBackground>
      <BottomContainer>
        <SummaryCol>{infoBox}</SummaryCol>
        <MainCol>
          <SectionsWrapper>{children}</SectionsWrapper>
        </MainCol>
      </BottomContainer>
    </Page>
  )
}

export default ProductPageTemplate
export type { ProductPageTemplateProps }
