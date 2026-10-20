"use client"

import React from "react"
import Link from "next/link"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { styled } from "ol-components"
import { FeatureFlags } from "@/common/feature_flags"
import {
  contractAdminView,
  contractAnalyticsView,
  contractLearnersView,
  contractView,
} from "@/common/urls"

type ContractManagerSection = "overview" | "analytics" | "learners" | "seats"

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
      enabled: true,
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

  if (visible.length < 2) return null

  return (
    <nav aria-label="Contract">
      <NavList>
        {visible.map((section) => (
          <li key={section.key}>
            <NavLink
              href={section.href}
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
