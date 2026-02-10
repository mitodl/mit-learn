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
import { backgroundSrcSetCSS } from "ol-utilities"
import { HOME } from "@/common/urls"
import backgroundSteps from "@/public/images/backgrounds/background_steps.jpg"
import { ButtonLink, styled } from "@mitodl/smoot-design"
import Image from "next/image"
import { HeadingIds } from "./util"
import { useFragmentScrollSpy } from "@/common/useFragmentScrollSpy"

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
  },
}))

const MainCol = styled.div({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
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

// Outer wrapper: sticky, clipped, and owns the fade overlays
const LinksWrapper = styled.div(({ theme }) => ({
  borderRadius: "100vh",
  padding: "12px 16px",
  boxShadow:
    "0 2px 4px 0 rgba(37, 38, 43, 0.10), 0 6px 24px 0 rgba(37, 38, 43, 0.24)",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `3px solid ${theme.custom.colors.red}`,
  marginTop: "-20px", // this is (height/2 + line_height/2) = align top of text with bottom of banner
  maxWidth: "100%",
  marginBottom: "40px",
  position: "sticky",
  top: `calc(${HEADER_HEIGHT}px + 24px)`,
  zIndex: 100,
  overflow: "hidden",
  // Subtle fade indicators on edges using pseudo-elements
  "&::before, &::after": {
    content: '""',
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "48px",
    pointerEvents: "none",
    zIndex: 1,
    opacity: 0,
    transition: "opacity 0.2s",
  },
  "&::before": {
    left: 0,
    background: `linear-gradient(to right, color-mix(in srgb, ${theme.custom.colors.red} 50%, transparent) 0%, transparent 70%)`,
  },
  "&::after": {
    right: 0,
    background: `linear-gradient(to left, color-mix(in srgb, ${theme.custom.colors.red} 50%, transparent) 0%, transparent 70%)`,
  },
  "&[data-show-left-fade='true']::before": {
    opacity: 1,
  },
  "&[data-show-right-fade='true']::after": {
    opacity: 1,
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

// Inner container: horizontally scrollable nav
const LinksContainer = styled.nav({
  display: "flex",
  flexWrap: "nowrap",
  // take full wrapper width; inner content overflows inside this scroller
  width: "100%",
  overflowX: "auto",
  scrollBehavior: "smooth",
  scrollbarWidth: "none", // Firefox
  "&::-webkit-scrollbar": {
    display: "none", // Chrome, Safari, Edge
  },
})
const NavLink = styled(ButtonLink, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(({ theme, active }) => [
  {
    minWidth: "unset",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  active
    ? {
        color: theme.custom.colors.white,
        backgroundColor: theme.custom.colors.red,
        "&:hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.mitRed,
        },
      }
    : {
        backgroundColor: theme.custom.colors.white,
        borderColor: theme.custom.colors.white,
        color: theme.custom.colors.red,
      },
])

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
}

type ProductPageTemplateProps = {
  tags: string[]
  currentBreadcrumbLabel: string
  title: string
  shortDescription: React.ReactNode
  imageSrc: string
  sidebarSummary: React.ReactNode
  children: React.ReactNode
  navLinks: HeadingData[]
}
const ProductPageTemplate: React.FC<ProductPageTemplateProps> = ({
  tags,
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
  const activeFragment =
    useFragmentScrollSpy(
      navLinks.map((link) => link.id),
      {
        // start intersection area below the sticky header to account for it covering the top of sections, and end it at 50% of viewport to ensure it overlaps during section transitions
        rootMargin: `-${HEADER_HEIGHT + 24 + 56}px 0px -50% 0px`,
      },
    ) ?? navLinks[0]?.id // fallback to first section
  const navLinkRefs = React.useRef<Map<string, HTMLAnchorElement>>(new Map())
  const scrollRef = React.useRef<HTMLElement | null>(null)
  const [showLeftFade, setShowLeftFade] = React.useState(false)
  const [showRightFade, setShowRightFade] = React.useState(false)

  const updateFades = React.useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    const isScrollable = scrollWidth > clientWidth

    // Show left fade if scrolled away from left edge
    setShowLeftFade(isScrollable && scrollLeft > 1)
    // Show right fade if not scrolled to right edge
    setShowRightFade(isScrollable && scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  React.useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    // Update on mount and when content changes
    updateFades()

    // Update on scroll
    container.addEventListener("scroll", updateFades)
    // Update on resize (in case content wrapping changes)
    window.addEventListener("resize", updateFades)

    return () => {
      container.removeEventListener("scroll", updateFades)
      window.removeEventListener("resize", updateFades)
    }
  }, [updateFades, navLinks])

  React.useEffect(() => {
    if (activeFragment) {
      const activeLink = navLinkRefs.current.get(activeFragment)
      if (activeLink) {
        activeLink.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        })
      }
    }
  }, [activeFragment])

  if (navLinks.length === 0) {
    return null
  }

  return (
    <LinksWrapper
      data-show-left-fade={showLeftFade}
      data-show-right-fade={showRightFade}
    >
      <LinksContainer aria-label={`${productNoun} Details`} ref={scrollRef}>
        {navLinks.map((heading) => {
          return (
            <NavLink
              edge="circular"
              key={heading.id}
              href={`#${heading.id}`}
              variant="secondary"
              size="small"
              active={activeFragment === heading.id}
              ref={(el: HTMLAnchorElement | null) => {
                if (el) {
                  navLinkRefs.current.set(heading.id, el)
                } else {
                  navLinkRefs.current.delete(heading.id)
                }
              }}
            >
              {heading.label}
            </NavLink>
          )
        })}
      </LinksContainer>
    </LinksWrapper>
  )
}

const WhoCanTake: React.FC<{ productNoun: string }> = ({ productNoun }) => {
  return (
    <WhoCanTakeSection aria-labelledby={HeadingIds.WhoCanTake}>
      <Typography variant="h4" component="h2" id={HeadingIds.WhoCanTake}>
        Who can take this {productNoun}?
      </Typography>
      Because of U.S. Office of Foreign Assets Control (OFAC) restrictions and
      other U.S. federal regulations, learners residing in one or more of the
      following countries or regions will not be able to register for this
      course: Iran, Cuba, Syria, North Korea and the Crimea, Donetsk People's
      Republic and Luhansk People's Republic regions of Ukraine.
    </WhoCanTakeSection>
  )
}

export default ProductPageTemplate
export { WhoCanTake, ProductNavbar }
export type { HeadingData, ProductPageTemplateProps }
