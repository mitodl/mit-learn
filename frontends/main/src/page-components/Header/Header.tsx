"use client"

import { env } from "@/env"
import React, { FunctionComponent } from "react"
import {
  styled,
  AppBar,
  NavDrawer,
  Toolbar,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"
import { ActionButtonLink } from "@mitodl/smoot-design"
import { RiSearch2Line, RiGlobalLine } from "@remixicon/react"
import { useToggle } from "ol-utilities"
import MITLogoLink from "@/components/MITLogoLink/MITLogoLink"
import UserMenu from "./UserMenu"
import { MenuButton } from "./MenuButton"
import HeaderNavLink from "./HeaderNavLink"
import { buildNavData } from "./navData"
import { SEARCH, ORGANIZATIONAL_LEARNING } from "@/common/urls"
import { useUserMe } from "api/hooks/user"
import { usePostHog, useFeatureFlagEnabled } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"

const Bar = styled(AppBar)(({ theme }) => ({
  padding: "16px 8px",
  backgroundColor: theme.custom.colors.navGray,
  boxShadow: "none",
  display: "flex",
  justifyContent: "space-between",
  flexDirection: "column",
  ".MuiToolbar-root": {
    minHeight: "auto",
  },
  height: HEADER_HEIGHT,
  [theme.breakpoints.down("md")]: {
    height: HEADER_HEIGHT_MD,
    padding: "0",
  },
}))

const FlexContainer = styled.div({
  display: "flex",
  alignItems: "center",
})

const DesktopOnly = styled(FlexContainer)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "flex",
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const MobileOnly = styled(FlexContainer)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "flex",
  },
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
}))

const StyledToolbar = styled(Toolbar)({
  flex: 1,
})

const StyledMITLogoLink = styled(MITLogoLink)(({ theme }) => ({
  img: {
    height: "24px",
    width: "auto",
    [theme.breakpoints.down("md")]: {
      height: "16px",
    },
  },
}))

const Spacer = styled.div({
  flex: "1",
})

const LeftSpacer = styled.div(({ theme }) => ({
  width: "24px",
  [theme.breakpoints.down("md")]: {
    width: "16px",
  },
}))

const StyledSearchButton = styled(ActionButtonLink)(({ theme }) => ({
  width: "auto",
  height: "auto",
  padding: "4px 16px",
  "&:hover": {
    svg: {
      opacity: 1,
    },
  },
  [theme.breakpoints.down("md")]: {
    padding: "0",
  },
  alignItems: "center",
  display: "inline-flex",
  justifyContent: "center",
}))

const StyledSearchIcon = styled(RiSearch2Line)(({ theme }) => ({
  width: "24px",
  height: "24px",
  color: theme.custom.colors.white,
  opacity: 0.5,
  margin: "4px 0",
  [theme.breakpoints.down("md")]: {
    opacity: 1,
  },
}))

const SearchButton: FunctionComponent = () => {
  return (
    <StyledSearchButton
      edge="circular"
      variant="text"
      href={SEARCH}
      aria-label="Search"
    >
      <StyledSearchIcon />
    </StyledSearchButton>
  )
}

const LoggedOutView: FunctionComponent = () => {
  return (
    <FlexContainer>
      <DesktopOnly>
        <SearchButton />
        <UserMenu variant="desktop" />
      </DesktopOnly>
      <MobileOnly>
        <SearchButton />
        <UserMenu variant="mobile" />
      </MobileOnly>
    </FlexContainer>
  )
}

const LoggedInView: FunctionComponent = () => {
  return (
    <FlexContainer>
      <SearchButton />
      <UserMenu />
    </FlexContainer>
  )
}

const UserView: FunctionComponent = () => {
  const { isLoading, data: user } = useUserMe()
  if (isLoading) {
    return null
  }
  return user?.is_authenticated ? <LoggedInView /> : <LoggedOutView />
}

const Header: FunctionComponent = () => {
  const posthog = usePostHog()
  const [drawerOpen, toggleDrawer] = useToggle(false)
  const desktopTrigger = React.useRef<HTMLButtonElement>(null)
  const mobileTrigger = React.useRef<HTMLButtonElement>(null)
  const drawerToggleEvent = drawerOpen
    ? PostHogEvents.ClosedNavDrawer
    : PostHogEvents.OpenedNavDrawer
  const posthogCapture = (event: string) => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(event)
    }
  }
  const menuClick = () => {
    toggleDrawer.toggle()
    posthogCapture(drawerToggleEvent)
  }

  /**
   * Unlike a flagged route, a nav entry has no 404 to fall back on, so it fails
   * closed: "not loaded yet" is treated the same as "off" rather than flashing
   * a link that may not be available.
   */
  const orgLearningFlag = useFeatureFlagEnabled(
    FeatureFlags.OrganizationalLearning,
  )
  const flagsLoaded = useFeatureFlagsLoaded()
  const showOrgLearning = Boolean(flagsLoaded && orgLearningFlag)

  const navData = React.useMemo(
    () => buildNavData(showOrgLearning),
    [showOrgLearning],
  )

  return (
    <div>
      <Bar position="fixed">
        <StyledToolbar variant="dense">
          <DesktopOnly>
            <StyledMITLogoLink logo="learn" />
            <LeftSpacer />
            <MenuButton
              ref={desktopTrigger}
              text="Explore MIT"
              onClick={menuClick}
              // "Selected" for a drawer trigger reads as "its drawer is open".
              active={drawerOpen}
            />
            {showOrgLearning ? (
              <HeaderNavLink
                href={ORGANIZATIONAL_LEARNING}
                label="For Organizations"
                icon={<RiGlobalLine aria-hidden />}
                onClick={() =>
                  posthogCapture(PostHogEvents.ClickedNavForOrganizations)
                }
              />
            ) : null}
          </DesktopOnly>
          <MobileOnly>
            <MenuButton
              ref={mobileTrigger}
              onClick={menuClick}
              active={drawerOpen}
              aria-label="Explore MIT"
            />
            <LeftSpacer />
            <StyledMITLogoLink logo="learn" />
          </MobileOnly>
          <Spacer />
          <UserView />
        </StyledToolbar>
      </Bar>

      <NavDrawer
        getClickAwayExcluded={() => [
          desktopTrigger.current,
          mobileTrigger.current,
        ]}
        navData={navData}
        open={drawerOpen}
        onClose={() => {
          posthogCapture(drawerToggleEvent)
          toggleDrawer.off()
        }}
        posthogCapture={posthogCapture}
      />
    </div>
  )
}

export default Header
