"use client"

import React, { useEffect, useRef } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { styled } from "ol-components"
import { FeatureFlags } from "@/common/feature_flags"
import { matchOrganizationBySlug } from "@/common/utils"
import {
  contractAdminView,
  contractAnalyticsView,
  contractLearnersView,
  contractView,
} from "@/common/urls"

type ContractManagerSection = "overview" | "analytics" | "learners" | "seats"

const FOCUS_RESTORE_KEY = "contract-manager-nav-focus"

/** Storage throws when site data is blocked, and a missed focus restore is harmless. */
const saveFocusTarget = (key: ContractManagerSection) => {
  try {
    sessionStorage.setItem(FOCUS_RESTORE_KEY, key)
  } catch {
    return
  }
}

const takeFocusTarget = () => {
  try {
    const key = sessionStorage.getItem(FOCUS_RESTORE_KEY)
    sessionStorage.removeItem(FOCUS_RESTORE_KEY)
    return key
  } catch {
    return null
  }
}

const NavList = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "24px",
  margin: 0,
  padding: 0,
  listStyle: "none",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    columnGap: "16px",
  },
}))

const NavLink = styled(Link)(({ theme }) => ({
  ...theme.typography.subtitle2,
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  marginBottom: "-1px",
  color: theme.custom.colors.silverGrayDark,
  textDecoration: "none",
  borderBottom: "3px solid transparent",
  ":hover": {
    color: theme.custom.colors.darkGray2,
  },
  '&[aria-current="page"]': {
    color: theme.custom.colors.darkGray2,
    borderBottomColor: theme.custom.colors.mitRed,
  },
}))

type ContractManagerNavProps = {
  orgSlug: string
  contractSlug: string
  current: ContractManagerSection
}

/**
 * Links between a contract's manager views. Plain links rather than ARIA tabs,
 * because each one loads a separate page.
 *
 * shortcut: every page renders its own nav, so a navigation remounts it and
 * drops focus to `<body>`. The activated link is remembered in
 * sessionStorage and refocused on the next mount. Replace with one shared
 * layout if these routes are ever moved under a common parent.
 */
const ContractManagerNav: React.FC<ContractManagerNavProps> = ({
  orgSlug,
  contractSlug,
  current,
}) => {
  const analyticsEnabled = useFeatureFlagEnabled(
    FeatureFlags.B2BAnalyticsDashboard,
  )
  const learnerAnalyticsEnabled = useFeatureFlagEnabled(
    FeatureFlags.B2BLearnerAnalytics,
  )
  const managerDashboardEnabled = useFeatureFlagEnabled(
    FeatureFlags.B2BContractManagerDashboard,
  )

  const { data: mitxOnlineUser } = useQuery(mitxUserQueries.me())
  /** The Overview page only resolves contracts from the user's own `b2b_organizations`. */
  const overviewAvailable = !!mitxOnlineUser?.b2b_organizations
    .find(matchOrganizationBySlug(orgSlug))
    ?.contracts.some((contract) => contract.slug === contractSlug)

  const sections: Array<{
    key: ContractManagerSection
    label: string
    href: string
    enabled: boolean | undefined
  }> = [
    {
      key: "overview",
      label: "Overview",
      href: contractView(orgSlug, contractSlug),
      enabled: overviewAvailable,
    },
    {
      key: "analytics",
      label: "Analytics",
      href: contractAnalyticsView(orgSlug, contractSlug),
      enabled: analyticsEnabled,
    },
    {
      key: "learners",
      label: "Learners",
      href: contractLearnersView(orgSlug, contractSlug),
      enabled: analyticsEnabled && learnerAnalyticsEnabled,
    },
    {
      key: "seats",
      label: "Manage seats",
      href: contractAdminView(orgSlug, contractSlug),
      enabled: managerDashboardEnabled,
    },
  ]
  const visible = sections.filter((section) => section.enabled)
  const showNav = visible.length >= 2

  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!showNav) return
    const key = takeFocusTarget()
    if (document.activeElement !== document.body) return
    navRef.current
      ?.querySelector<HTMLAnchorElement>(`a[data-section="${key}"]`)
      ?.focus()
  }, [showNav])

  if (!showNav) return null

  return (
    <nav aria-label="Contract" ref={navRef}>
      <NavList>
        {visible.map((section) => (
          <li key={section.key}>
            <NavLink
              href={section.href}
              data-section={section.key}
              onClick={(event) => {
                const opensElsewhere =
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                if (section.key !== current && !opensElsewhere) {
                  saveFocusTarget(section.key)
                }
              }}
              aria-current={section.key === current ? "page" : undefined}
            >
              {section.label}
            </NavLink>
          </li>
        ))}
      </NavList>
    </nav>
  )
}

export default ContractManagerNav
export type { ContractManagerNavProps, ContractManagerSection }
