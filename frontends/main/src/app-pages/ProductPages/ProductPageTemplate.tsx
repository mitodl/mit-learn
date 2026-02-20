"use client"

import React from "react"
import {
  Container,
  Stack,
  Breadcrumbs,
  BannerBackground,
  Typography,
} from "ol-components"
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { styled, VisuallyHidden } from "@mitodl/smoot-design"
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
    alignItems: "center",
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
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
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

const SummaryRoot = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  [theme.breakpoints.up("md")]: {
    position: "sticky",
    marginTop: "-54px",
    top: "calc(40px + 32px + 24px)",
    borderRadius: "4px",
  },
  [theme.breakpoints.between("sm", "md")]: {
    flexDirection: "row",
    gap: "48px",
  },
  [theme.breakpoints.down("md")]: {
    marginTop: "24px",
  },
}))

type ProductPageTemplateProps = {
  tags: string[]
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  sidebarSummary: React.ReactNode
  summaryTitle: string
  children: React.ReactNode
  navbar: React.ReactNode
  enrollButton?: React.ReactNode
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  tags,
  currentBreadcrumbLabel,
  title,
  shortDescription,
  imageSrc,
  sidebarSummary,
  summaryTitle,
  children,
  enrollButton,
  navbar,
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
            <SidebarImage
              priority
              width={410}
              height={230}
              src={imageSrc}
              alt=""
            />
          </SidebarCol>
        </TopContainer>
      </BannerBackground>
      <BottomContainer>
        {/*
         * The summary section is rendered 3 times (desktop, tablet, mobile)
         * with different layouts, but only one is visible at a time via CSS.
         * A single visually-hidden heading serves all three.
         */}
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>{summaryTitle}</h2>
        </VisuallyHidden>
        <SidebarCol showAbove="md">
          <SummaryRoot as="section" aria-labelledby={HeadingIds.Summary}>
            {enrollButton}
            {sidebarSummary}
          </SummaryRoot>
        </SidebarCol>
        <MainCol>
          {navbar}
          <Show showBetween={["sm", "md"]}>
            <SummaryRoot as="section" aria-labelledby={HeadingIds.Summary}>
              {sidebarSummary}
              <Stack gap="16px">
                <SidebarImage width={410} height={230} src={imageSrc} alt="" />
                {enrollButton}
              </Stack>
            </SummaryRoot>
          </Show>
          <SidebarCol showBelow="sm" alignSelf="center">
            <SummaryRoot as="section" aria-labelledby={HeadingIds.Summary}>
              <SidebarImage width={410} height={230} src={imageSrc} alt="" />
              {enrollButton}
              {sidebarSummary}
            </SummaryRoot>
          </SidebarCol>
          <SectionsWrapper>{children}</SectionsWrapper>
        </MainCol>
      </BottomContainer>
    </Page>
  )
}

export default ProductPageTemplate
export type { ProductPageTemplateProps }
