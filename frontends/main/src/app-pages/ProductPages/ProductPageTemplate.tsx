"use client"

import React from "react"
import {
  Container,
  Stack,
  Breadcrumbs,
  BannerBackground,
  Typography,
  HEADER_HEIGHT,
  Grid2,
} from "ol-components"
import { convertToEmbedUrl, hexToRgba } from "@/common/utils"
import { HOME } from "@/common/urls"
import { Button, styled } from "@mitodl/smoot-design"
import Image from "next/image"
import type { Breakpoint } from "@mui/system"
import NiceModal from "@ebay/nice-modal-react"
import { useHubspotFormDetail } from "api/hooks/hubspot"
import { StayUpdatedModal } from "./StayUpdatedModal"
import { getStayUpdatedHubspotFormId } from "@/common/config"

const GradientBanner = styled(BannerBackground)(({ theme }) => ({
  background:
    "radial-gradient(53.28% 106.57% at 50% 14.6%, #1D7B83 0%, #1E1E54 100%)",
  padding: 0,
  [theme.breakpoints.down("sm")]: {
    padding: 0,
  },
}))

const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span": {
    paddingBottom: 0,
  },
}))

const TitleBox = styled(Stack)(({ theme }) => ({
  color: theme.custom.colors.white,
}))

const ContentStack = styled(Stack)(({ theme }) => ({
  gap: "32px",
  marginTop: "16px",
  [theme.breakpoints.down("md")]: {
    gap: "16px",
    marginTop: 0,
  },
}))

const EnrollButton = styled.div(({ theme }) => ({
  width: "240px",

  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const StayUpdatedButton = styled(Button)(({ theme }) => ({
  color: theme.custom.colors.white,
  borderColor: theme.custom.colors.lightGray2,
  borderWidth: "1px",
  width: "200px",

  "&&:hover": {
    backgroundColor: hexToRgba(theme.custom.colors.white, 0.2),
  },
  [theme.breakpoints.between("sm", "md")]: {
    width: "240px",
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  paddingBottom: "80px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "24px",
  },
  height: "100%",
}))

const TopContainer = styled(Container)(({ theme }) => ({
  padding: "104px 0",

  [theme.breakpoints.down("md")]: {
    padding: "64px 40px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "32px 24px",
  },
}))
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
  borderRadius: "16px",
  border: "none",
  boxShadow: "0 0 48.4px 0 rgba(0, 0, 0, 0.50)",
  width: "100%",
  aspectRatio: "16 / 9",
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

const SidebarImage = styled(Image)(({ theme }) => ({
  borderRadius: "16px",
  boxShadow: "0 0 48.4px 0 rgba(0, 0, 0, 0.50)",
  aspectRatio: "16/9",
  height: "auto",
  objectFit: "cover",
  objectPosition: "center",
  justifySelf: "end",
  maxWidth: "100%",
  maxHeight: "500px",
  display: "block",
  "& img": {
    objectFit: "cover",
    objectPosition: "center",
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}))

const ShortDescription = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  lineHeight: "1.5rem",
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2,
    lineHeight: "1.5rem",
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
      width={540}
      height={306}
      src={imageSrc}
      alt=""
    />
  )
}

type ProductPageTemplateProps = {
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  videoUrl?: string | null
  infoBox: React.ReactNode
  enrollmentAction: React.ReactNode
  children: React.ReactNode
  showStayUpdated?: boolean
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  currentBreadcrumbLabel,
  title,
  shortDescription,
  imageSrc,
  videoUrl,
  infoBox,
  children,
  enrollmentAction,
  showStayUpdated,
}) => {
  const stayUpdatedFormId = getStayUpdatedHubspotFormId()
  const shouldShowStayUpdatedButton = Boolean(
    stayUpdatedFormId && showStayUpdated,
  )
  const stayUpdatedParams = stayUpdatedFormId
    ? { form_id: stayUpdatedFormId }
    : undefined
  const formQuery = useHubspotFormDetail(stayUpdatedParams, {
    enabled: shouldShowStayUpdatedButton,
  })

  return (
    <Page>
      <GradientBanner>
        <TopContainer data-testid="banner-container">
          <Grid2 container spacing={{ xs: 2, sm: 2, md: 8 }}>
            <Grid2 size={{ xs: 12, sm: 6, md: 6.5 }}>
              <MainCol>
                <StyledBreadcrumbs
                  variant="dark"
                  ancestors={[{ href: HOME, label: "Home" }]}
                  current={currentBreadcrumbLabel}
                />
                <TitleBox alignItems="flex-start" gap="4px">
                  <ContentStack alignItems="flex-start">
                    <SidebarCol showBelow="sm" alignSelf="flex-end">
                      <SidebarMedia
                        videoUrl={videoUrl}
                        imageSrc={imageSrc}
                        title={title}
                      />
                    </SidebarCol>
                    <Typography
                      component="h1"
                      typography={{ xs: "h4", sm: "h4", md: "h3" }}
                      style={{ lineHeight: "2.25rem" }}
                    >
                      {title}
                    </Typography>
                    <ShortDescription>{shortDescription}</ShortDescription>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      gap="24px"
                      sx={(theme) => ({
                        [theme.breakpoints.down("sm")]: {
                          width: "100%",
                        },
                      })}
                    >
                      <EnrollButton>{enrollmentAction}</EnrollButton>
                      {shouldShowStayUpdatedButton ? (
                        <StayUpdatedButton
                          size="large"
                          variant="secondary"
                          disabled={formQuery.isError}
                          onClick={() => NiceModal.show(StayUpdatedModal)}
                        >
                          Stay Updated
                        </StayUpdatedButton>
                      ) : null}
                    </Stack>
                  </ContentStack>
                </TitleBox>
              </MainCol>
            </Grid2>
            <Grid2
              size={{ xs: 12, sm: 6, md: 5.5 }}
              style={{ display: "flex", alignSelf: "center" }}
            >
              <SidebarCol showAbove="sm" alignSelf="flex-end">
                <SidebarMedia
                  videoUrl={videoUrl}
                  imageSrc={imageSrc}
                  title={title}
                  priority
                />
              </SidebarCol>
            </Grid2>
          </Grid2>
        </TopContainer>
      </GradientBanner>
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
