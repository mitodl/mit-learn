"use client"

import React from "react"
import { UserMenu as SharedUserMenu } from "@mitodl/smoot-design"
import type { UserMenuItem } from "@mitodl/smoot-design"
import { styled } from "ol-components"
import * as urls from "@/common/urls"
import { useUserMe } from "api/hooks/user"

/**
 * Placement only; the menu's appearance is smoot-design's. The same class
 * lands on the logged-in trigger and on either login button, all of which
 * take the same margins.
 */
const StyledUserMenu = styled(SharedUserMenu)(({ theme }) => ({
  margin: "0 16px",
  [theme.breakpoints.down("md")]: {
    margin: "0 24px",
  },
}))

type DeviceType = "mobile" | "desktop"
type UserMenuProps = {
  variant?: DeviceType
}

/**
 * Learn's binding for the UserMenu shared with OCW: supplies auth state, the
 * app's URLs, and header placement. Everything the two headers should agree on
 * lives in smoot-design.
 */
const UserMenu: React.FC<UserMenuProps> = ({ variant }) => {
  const { isLoading, data: user } = useUserMe()
  if (isLoading) {
    return null
  }

  const items: (UserMenuItem & { allow: boolean })[] = [
    {
      label: "Dashboard",
      key: "dashboard",
      allow: !!user?.is_authenticated,
      href: urls.DASHBOARD_HOME,
    },
    {
      label: "Learning Paths",
      key: "learningpaths",
      allow: !!user?.is_learning_path_editor,
      href: urls.LEARNINGPATH_LISTING,
    },
    {
      label: "Article",
      key: "articles",
      allow: !!user?.is_article_editor,
      href: urls.websiteContentCreateView("article"),
    },
    {
      label: "News",
      key: "news",
      allow: !!user?.is_article_editor,
      href: urls.websiteContentCreateView("news"),
    },
    {
      label: "Log Out",
      key: "logout",
      allow: !!user?.is_authenticated,
      href: urls.LOGOUT,
      LinkComponent: "a",
    },
  ]

  return (
    <StyledUserMenu
      user={user?.is_authenticated ? { name: user.profile?.name } : undefined}
      items={items
        .filter(({ allow }) => allow)
        .map(({ allow, ...item }) => item)}
      loginUrl={urls.auth({
        next: {
          pathname: urls.DASHBOARD_HOME,
          searchParams: null,
        },
      })}
      variant={variant}
    />
  )
}

export default UserMenu
