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
import { Button, styled, VisuallyHidden } from "@mitodl/smoot-design"
import { RiSparkling2Line } from "@remixicon/react"
import Image from "next/image"
import { HeadingIds } from "./util"
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

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "0px",
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
  marginTop: "40px",
  [theme.breakpoints.down("md")]: {
    gap: "40px",
    marginTop: "36px",
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
    top: `${HEADER_HEIGHT + 24}px`,
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

/**
 * Outer card wrapper: border, shadow, radius. No padding — children control
 * their own insets so that elements like the bundle upsell can span edge-to-edge.
 */
const SummaryCard = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  overflow: "hidden",
  [theme.breakpoints.up("md")]: {
    marginTop: "40px",
  },
}))

/** Padded content area inside the summary card. */
const SummaryContent = styled.div(({ theme }) => ({
  padding: "24px",
  [theme.breakpoints.up("md")]: {
    padding: "24px 32px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
  },
}))

/** Enrollment button — only visible on desktop (sticky sidebar). */
const DesktopEnrollArea = styled(Show)({
  padding: "8px 32px 24px",
})

const AskTimButton = styled(Button)(({ theme }) => ({
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.2)",
  marginTop: "16px",
  alignSelf: "flex-start",
  color: theme.custom.colors.darkGray2,
  svg: {
    color: theme.custom.colors.mitRed,
  },
}))

type ProductPageTemplateProps = {
  tags: string[]
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  videoUrl?: string | null
  sidebarSummary: React.ReactNode
  summaryTitle: string
  children: React.ReactNode
  enrollButton?: React.ReactNode
  programUpsell?: React.ReactNode
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  tags,
  currentBreadcrumbLabel,
  title,
  shortDescription,
  imageSrc,
  videoUrl,
  sidebarSummary,
  summaryTitle,
  children,
  enrollButton,
  programUpsell,
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
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>{summaryTitle}</h2>
        </VisuallyHidden>
        <SummaryCol>
          <SummaryCard as="section" aria-labelledby={HeadingIds.Summary}>
            <SummaryContent>{sidebarSummary}</SummaryContent>
            <DesktopEnrollArea showAbove="md">{enrollButton}</DesktopEnrollArea>
            {programUpsell}
          </SummaryCard>
          <AskTimButton
            variant="bordered"
            size="large"
            startIcon={<RiSparkling2Line />}
            onClick={() => console.log("AskTIM clicked")}
            data-testid="ask-tim-button"
          >
            AskTIM about this course
          </AskTimButton>
        </SummaryCol>
        <MainCol>
          <SectionsWrapper>{children}</SectionsWrapper>
        </MainCol>
      </BottomContainer>
    </Page>
  )
}

export default ProductPageTemplate
export type { ProductPageTemplateProps }
