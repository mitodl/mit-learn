"use client"

import React from "react"
import {
  RiAccountCircleFill,
  RiDashboardLine,
  RiBookmarkLine,
  RiEditLine,
  RiNotificationLine,
} from "@remixicon/react"
import {
  Card,
  Container,
  Skeleton,
  Tab,
  TabButtonLink,
  TabButtonList,
  TabContext,
  TabPanel,
  TabList,
  Typography,
  styled,
} from "ol-components"
import Link from "next/link"
import { useUserMe } from "api/hooks/user"
import { useParams } from "next/navigation"
import UserListListingComponent from "@/page-components/UserListListing/UserListListing"
import backgroundImage from "@/public/images/backgrounds/user_menu_background.svg"
import { ProfileContent } from "./ProfileContent"
import { useProfileMeQuery } from "api/hooks/profile"
import { UserListDetailsContent } from "./UserListDetailsContent"
import { SettingsContent } from "./SettingsContent"
import { DASHBOARD_HOME, MY_LISTS, PROFILE, SETTINGS } from "@/common/urls"
import dynamic from "next/dynamic"
import { HomeContent, TitleText } from "./HomeContent"

const LearningResourceDrawer = dynamic(
  () =>
    import("@/page-components/LearningResourceDrawer/LearningResourceDrawer"),
)

/**
 *
 * The desktop and mobile layouts are significantly different, so we use the
 * `MobileOnly` and `DesktopOnly` components to conditionally render the
 * appropriate layout based on the screen size.
 *
 * **/

const MobileOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "none",
  },
}))

const DesktopOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const Background = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.lightGray1,
  backgroundImage: `url(${backgroundImage.src})`,
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  height: "100%",
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
  },
}))

const Page = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: "40px 84px 80px 84px",
  gap: "80px",
  height: "100%",
  [theme.breakpoints.down("md")]: {
    padding: "0",
    gap: "24px",
  },
}))

const DashboardContainer = styled(Container)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
    gap: "24px",
  },
}))

const DashboardGrid = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr)",
  gap: "48px",
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "24px",
  },
}))

const DashboardGridItem = styled.div({
  display: "flex",
  "> *": {
    minWidth: "0px",
  },
})

const ProfileSidebar = styled(Card)(({ theme }) => ({
  position: "fixed",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "300px",
  boxShadow: "-4px 4px 0px 0px #A31F34",
  [theme.breakpoints.down("md")]: {
    position: "relative",
  },
}))

const ProfilePhotoContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  padding: "12px 20px",
  gap: "16px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  background: `linear-gradient(90deg, ${theme.custom.colors.white} 0%, ${theme.custom.colors.lightGray1} 100%)`,
}))

const UserNameContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "8px",
})

const UserIcon = styled(RiAccountCircleFill)(({ theme }) => ({
  width: "64px",
  height: "64px",
  color: theme.custom.colors.black,
}))

const UserNameText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.h5,
}))

const TabsContainer = styled(TabList)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  textDecoration: "none",
  "& .MuiTabs-indicator": {
    display: "none",
  },
  a: {
    padding: "0",
    opacity: "1",

    "&:focus-visible": {
      outlineOffset: "-1px",
    },
  },
  "&:hover": {
    a: {
      textDecoration: "none",
    },
  },
  ".MuiTab-root[aria-selected='true']": {
    ".user-menu-link-icon, .user-menu-link-text": {
      color: theme.custom.colors.mitRed,
    },
  },
}))

const TabContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  flex: "1 0 0",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "16px 20px",
  gap: "8px",
  width: "300px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray1}`,
  "&:hover": {
    ".user-menu-link-icon, .user-menu-link-text": {
      color: theme.custom.colors.mitRed,
    },
  },
}))

const LinkIconContainer = styled.div(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const LinkText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
}))

const TabPanelStyled = styled(TabPanel)({
  padding: "0",
  width: "100%",
})

const TabKeys = {
  [DASHBOARD_HOME]: "home",
  [MY_LISTS]: "my-lists",
  [PROFILE]: "profile",
  [SETTINGS]: "settings",
}

const TabLabels = {
  [DASHBOARD_HOME]: "Home",
  [MY_LISTS]: "My Lists",
  [PROFILE]: "Profile",
  [SETTINGS]: "Settings",
}

const DesktopTabLabel: React.FC<{
  icon: React.ReactNode
  text?: string
}> = ({ text, icon }) => {
  return (
    <TabContainer>
      <LinkIconContainer className="user-menu-link-icon">
        {icon}
      </LinkIconContainer>
      <LinkText className="user-menu-link-text">{text}</LinkText>
    </TabContainer>
  )
}

type TabData = {
  value: string
  href: string
  label: {
    mobile: string
    desktop: React.ReactNode
  }
}
const TAB_DATA: TabData[] = [
  {
    value: DASHBOARD_HOME,
    href: DASHBOARD_HOME,
    label: {
      mobile: "Home",
      desktop: <DesktopTabLabel icon={<RiDashboardLine />} text="Home" />,
    },
  },
  {
    value: MY_LISTS,
    href: MY_LISTS,
    label: {
      mobile: "My Lists",
      desktop: <DesktopTabLabel icon={<RiBookmarkLine />} text="My Lists" />,
    },
  },
  {
    value: PROFILE,
    href: PROFILE,
    label: {
      mobile: "Profile",
      desktop: <DesktopTabLabel icon={<RiEditLine />} text="Profile" />,
    },
  },
  {
    value: SETTINGS,
    href: SETTINGS,
    label: {
      mobile: "Settings",
      desktop: (
        <DesktopTabLabel icon={<RiNotificationLine />} text="Settings" />
      ),
    },
  },
]

type RouteParams = {
  id: string
}

const DashboardPage: React.FC = () => {
  const { isLoading: isLoadingUser, data: user } = useUserMe()
  const { isLoading: isLoadingProfile, data: profile } = useProfileMeQuery()
  const params = useParams<{ tab: string }>()

  const appRouterPath = `${DASHBOARD_HOME}/${params.tab}`

  const id = Number(useParams<RouteParams>().id) || -1
  const showUserListDetail = appRouterPath === MY_LISTS && id !== -1

  const tabValue = showUserListDetail
    ? MY_LISTS
    : [DASHBOARD_HOME, MY_LISTS, PROFILE, SETTINGS].includes(appRouterPath)
      ? appRouterPath
      : DASHBOARD_HOME

  const desktopMenu = (
    <ProfileSidebar>
      <Card.Content>
        <ProfilePhotoContainer>
          <UserIcon />
          <UserNameContainer>
            {isLoadingUser ? (
              <Skeleton variant="text" width={128} height={32} />
            ) : (
              <UserNameText>{`${user?.profile?.name}`}</UserNameText>
            )}
          </UserNameContainer>
        </ProfilePhotoContainer>
        <TabsContainer
          orientation="vertical"
          data-testid="desktop-nav"
          role="navigation"
        >
          {TAB_DATA.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label.desktop}
              component={Link}
              href={tab.href}
            />
          ))}
        </TabsContainer>
      </Card.Content>
    </ProfileSidebar>
  )

  const mobileMenu = (
    <TabButtonList data-testid="mobile-nav" role="navigation">
      {TAB_DATA.map((tab) => (
        <TabButtonLink
          key={tab.value}
          value={tab.value}
          href={tab.href}
          label={tab.label.mobile}
        />
      ))}
    </TabButtonList>
  )

  return (
    <Background>
      <Page>
        <LearningResourceDrawer />
        <DashboardContainer>
          <TabContext value={tabValue}>
            <DashboardGrid>
              <DashboardGridItem>
                <MobileOnly>{mobileMenu}</MobileOnly>
                <DesktopOnly>{desktopMenu}</DesktopOnly>
              </DashboardGridItem>
              {showUserListDetail ? (
                <DashboardGridItem>
                  <UserListDetailsContent userListId={id} />
                </DashboardGridItem>
              ) : (
                <DashboardGridItem>
                  <TabPanelStyled value={DASHBOARD_HOME}>
                    <HomeContent />
                  </TabPanelStyled>
                  <TabPanelStyled value={MY_LISTS}>
                    <UserListListingComponent title="My Lists" />
                  </TabPanelStyled>
                  <TabPanelStyled value={PROFILE}>
                    <TitleText component="h1">Profile</TitleText>
                    {isLoadingProfile || !profile ? (
                      <Skeleton variant="text" width={128} height={32} />
                    ) : (
                      <div id="user-profile-edit">
                        <ProfileContent profile={profile} />
                      </div>
                    )}
                  </TabPanelStyled>
                  <TabPanelStyled value={SETTINGS}>
                    <TitleText component="h1">Settings</TitleText>
                    {isLoadingProfile || !profile ? (
                      <Skeleton variant="text" width={128} height={32} />
                    ) : (
                      <div id="user-settings">
                        <SettingsContent />
                      </div>
                    )}
                  </TabPanelStyled>
                </DashboardGridItem>
              )}
            </DashboardGrid>
          </TabContext>
        </DashboardContainer>
      </Page>
    </Background>
  )
}

export default DashboardPage

export { TabKeys as DashboardTabKeys, TabLabels as DashboardTabLabels }
