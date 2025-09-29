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
import { ButtonLink, styled } from "@mitodl/smoot-design"
import Image from "next/image"
import { HeadingIds } from "./util"

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  paddingBottom: "24px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "16px",
  },
}))

const TitleBox = styled(Stack)(({ theme }) => ({
  color: theme.custom.colors.white,
}))
const OfferedByTag = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGray1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "32px",
  padding: "0 12px",
  borderRadius: "4px",
  marginBottom: "4px",
  ...theme.typography.subtitle1,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const Page = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  paddingBottom: "80px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "24px",
  },
}))

const TopContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
  gap: "60px",
})
const BottomContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: "60px",
  flexDirection: "row-reverse",

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "center",
    gap: "0px",
  },
}))

const MainCol = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
})

const SidebarCol = styled.div(({ theme }) => ({
  width: "100%",
  maxWidth: "410px",
  [theme.breakpoints.down("md")]: {
    marginTop: "24px",
  },
}))
const SidebarSpacer = styled.div(({ theme }) => ({
  width: "410px",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const StyledLink = styled(ButtonLink)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    backgroundColor: theme.custom.colors.lightGray1,
    border: `1px solid ${theme.custom.colors.lightGray2}`,
  },
}))

const LinksContainer = styled.nav(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  [theme.breakpoints.up("md")]: {
    gap: "24px",
    padding: "12px 16px",
    backgroundColor: theme.custom.colors.white,
    borderRadius: "4px",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
    marginTop: "-24px",
    width: "calc(100%)",
    marginBottom: "40px",
  },
  [theme.breakpoints.down("md")]: {
    alignSelf: "center",
    gap: "8px",
    rowGap: "16px",
    padding: 0,
    margin: "24px 0",
  },
}))

const SidebarImageWrapper = styled.div(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    height: "0px",
  },
}))
const SidebarImage = styled(Image)(({ theme }) => ({
  borderRadius: "4px",
  width: "100%",
  maxWidth: "410px",
  height: "230px",
  display: "block",
  [theme.breakpoints.up("md")]: {
    transform: "translateY(-100%)",
  },
  [theme.breakpoints.down("md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px 4px 0 0",
  },
}))

const WhoCanTakeSection = styled.section(({ theme }) => ({
  padding: "32px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  ...theme.typography.body1,
  lineHeight: "1.5",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
    gap: "16px",
    ...theme.typography.body2,
  },
}))

type HeadingData = {
  id: HeadingIds
  label: string
  variant: "primary" | "secondary"
}

type ProductPageTemplateProps = {
  offeredBy: string
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  sidebarSummary: React.ReactNode
  children: React.ReactNode
  navLinks: HeadingData[]
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  offeredBy,
  currentBreadcrumbLabel,
  title,
  shortDescription,
  imageSrc,
  sidebarSummary,
  children,
}) => {
  return (
    <Page>
      <BannerBackground backgroundUrl={backgroundSrcSetCSS(backgroundSteps)}>
        <TopContainer>
          <MainCol>
            <StyledBreadcrumbs
              variant="dark"
              ancestors={[{ href: HOME, label: "Home" }]}
              current={currentBreadcrumbLabel}
            />
            <TitleBox alignItems="flex-start" gap="4px">
              <OfferedByTag>{offeredBy}</OfferedByTag>
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
          <SidebarSpacer></SidebarSpacer>
        </TopContainer>
      </BannerBackground>
      <BottomContainer>
        <SidebarCol>
          <SidebarImageWrapper>
            <SidebarImage width={410} height={230} src={imageSrc} alt="" />
          </SidebarImageWrapper>
          {sidebarSummary}
        </SidebarCol>
        <MainCol>{children}</MainCol>
      </BottomContainer>
    </Page>
  )
}

const ProductNavbar: React.FC<{
  navLinks: HeadingData[]
  productNoun: string
}> = ({ navLinks, productNoun }) => {
  if (navLinks.length === 0) {
    return null
  }
  return (
    <LinksContainer aria-label={`${productNoun} Details`}>
      {navLinks.map((heading) => {
        const LinkComponent =
          heading.variant === "primary" ? ButtonLink : StyledLink
        return (
          <LinkComponent
            key={heading.id}
            href={`#${heading.id}`}
            variant={heading.variant}
            size="small"
          >
            {heading.label}
          </LinkComponent>
        )
      })}
    </LinksContainer>
  )
}

const WhoCanTake: React.FC<{ productNoun: string }> = ({ productNoun }) => {
  return (
    <WhoCanTakeSection aria-labelledby={HeadingIds.WhoCanTake}>
      <Typography variant="h4" component="h2" id={HeadingIds.WhoCanTake}>
        Who can take this {productNoun}?
      </Typography>
    </WhoCanTakeSection>
  )
}

export default ProductPageTemplate
export { WhoCanTake, ProductNavbar }
export type { HeadingData, ProductPageTemplateProps }
