"use client"

import React, { FunctionComponent } from "react"
import type { NavData } from "ol-components"
import { styled, AppBar, NavDrawer, Toolbar } from "ol-components"
import { ActionButtonLink } from "@mitodl/smoot-design"
import {
  RiSearch2Line,
  RiPencilRulerLine,
  RiStackLine,
  RiBookMarkedLine,
  RiPresentationLine,
  RiNodeTree,
  RiVerifiedBadgeLine,
  RiFileAddLine,
  RiTimeLine,
  RiPriceTag3Line,
  RiAwardLine,
  RiThumbUpLine,
} from "@remixicon/react"
import { useToggle } from "ol-utilities"
import MITLogoLink from "@/components/MITLogoLink/MITLogoLink"
import UserMenu from "./UserMenu"
import { MenuButton } from "./MenuButton"
import {
  DEPARTMENTS,
  TOPICS,
  SEARCH,
  UNITS,
  SEARCH_NEW,
  SEARCH_UPCOMING,
  SEARCH_POPULAR,
  SEARCH_FREE,
  SEARCH_CERTIFICATE,
  SEARCH_COURSE,
  SEARCH_PROGRAM,
  SEARCH_LEARNING_MATERIAL,
} from "@/common/urls"
import { useUserMe } from "api/hooks/user"
import { usePostHog } from "posthog-js/react"
import { PostHogEvents } from "@/common/constants"

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
  height: theme.custom.dimensions.headerHeight,
  [theme.breakpoints.down("md")]: {
    height: theme.custom.dimensions.headerHeightSm,
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

const navData: NavData = {
  sections: [
    {
      title: "LEARN",
      items: [
        {
          title: "Courses",
          icon: <RiPencilRulerLine />,
          description:
            "Single courses on a specific subject, taught by MIT instructors",
          href: SEARCH_COURSE,
          posthogEvent: PostHogEvents.ClickedNavBrowseCourses,
        },
        {
          title: "Programs",
          icon: <RiStackLine />,
          description:
            "A series of courses for in-depth learning across a range of topics",
          href: SEARCH_PROGRAM,
          posthogEvent: PostHogEvents.ClickedNavBrowsePrograms,
        },
        {
          title: "Learning Materials",
          icon: <RiBookMarkedLine />,
          description:
            "Free learning and teaching materials, including videos, podcasts, lecture notes, and more",
          href: SEARCH_LEARNING_MATERIAL,
          posthogEvent: PostHogEvents.ClickedNavBrowseLearningMaterials,
        },
      ],
    },
    {
      title: "BROWSE",
      items: [
        {
          title: "By Topic",
          icon: <RiPresentationLine />,
          href: TOPICS,
          posthogEvent: PostHogEvents.ClickedNavBrowseTopics,
        },
        {
          title: "By Department",
          icon: <RiNodeTree />,
          href: DEPARTMENTS,
          posthogEvent: PostHogEvents.ClickedNavBrowseDepartments,
        },
        {
          title: "By Provider",
          icon: <RiVerifiedBadgeLine />,
          href: UNITS,
          posthogEvent: PostHogEvents.ClickedNavBrowseProviders,
        },
      ],
    },
    {
      title: "DISCOVER LEARNING RESOURCES",
      items: [
        {
          title: "Recently Added",
          icon: <RiFileAddLine />,
          href: SEARCH_NEW,
          posthogEvent: PostHogEvents.ClickedNavBrowseNew,
        },
        {
          title: "Popular",
          href: SEARCH_POPULAR,
          icon: <RiThumbUpLine />,
          posthogEvent: PostHogEvents.ClickedNavBrowsePopular,
        },
        {
          title: "Upcoming",
          icon: <RiTimeLine />,
          href: SEARCH_UPCOMING,
          posthogEvent: PostHogEvents.ClickedNavBrowseUpcoming,
        },
        {
          title: "Free",
          icon: <RiPriceTag3Line />,
          href: SEARCH_FREE,
          posthogEvent: PostHogEvents.ClickedNavBrowseFree,
        },
        {
          title: "With Certificate",
          icon: <RiAwardLine />,
          href: SEARCH_CERTIFICATE,
          posthogEvent: PostHogEvents.ClickedNavBrowseCertificate,
        },
      ],
    },
  ],
}

const Header: FunctionComponent = () => {
  const posthog = usePostHog()
  const [drawerOpen, toggleDrawer] = useToggle(false)
  const desktopTrigger = React.useRef<HTMLButtonElement>(null)
  const mobileTrigger = React.useRef<HTMLButtonElement>(null)
  const { data: user } = useUserMe()
  const drawerToggleEvent = drawerOpen
    ? PostHogEvents.ClosedNavDrawer
    : PostHogEvents.OpenedNavDrawer
  const posthogCapture = (event: string) => {
    if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
      posthog.capture(event)
    }
  }
  const menuClick = () => {
    toggleDrawer.toggle()
    posthogCapture(drawerToggleEvent)
  }

  return (
    <div>
      <Bar position="fixed">
        <StyledToolbar variant="dense">
          <DesktopOnly>
            <StyledMITLogoLink
              logo={user?.is_authenticated ? "learn_authenticated" : "learn"}
            />
            <LeftSpacer />
            <MenuButton
              ref={desktopTrigger}
              text="Explore MIT"
              onClick={menuClick}
            />
          </DesktopOnly>
          <MobileOnly>
            <MenuButton ref={mobileTrigger} onClick={menuClick} />
            <LeftSpacer />
            <StyledMITLogoLink
              logo={user?.is_authenticated ? "learn_authenticated" : "learn"}
            />
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
