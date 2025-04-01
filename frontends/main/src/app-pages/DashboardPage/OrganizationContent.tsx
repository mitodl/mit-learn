"use client"

import React from "react"
import { User, useUserMe } from "api/hooks/user"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { UseQueryResult } from "@tanstack/react-query"

type Organization = { id: number; name: string }
type UserWithOrgsField = User & { organizations: Organization[] }

/**
 * TEMPORARY MOCKED ORGANIZATIONS
 *
 * This should be replaced with useUserMe() once the backend is ready.
 */
const useUserMeWithMockedOrgs = (): UseQueryResult<
  UserWithOrgsField,
  Error
> => {
  const query = useUserMe() as UseQueryResult<UserWithOrgsField, Error>
  const isOrgDashboardEnabled = useFeatureFlagEnabled(
    FeatureFlags.OrganizationDashboard,
  )
  if (!query.data) return query
  const organizations = isOrgDashboardEnabled
    ? [
        { id: 488, name: "Organization X" },
        { id: 522, name: "Organization Y" },
      ]
    : []
  return { ...query, data: { ...query.data, organizations } }
}

type OrganizationContentProps = {
  orgId: number
}
const OrganizationContent: React.FC<OrganizationContentProps> = ({ orgId }) => {
  const userQuery = useUserMeWithMockedOrgs()
  const organization = userQuery.data?.organizations.find(
    (org) => org.id === orgId,
  )

  return (
    <div>
      <h1>Organization Content for {organization?.name}</h1>
      <p>This is the organization content page for org {orgId}</p>
    </div>
  )
}
export default OrganizationContent

export type { OrganizationContentProps }

// To be removed
export { useUserMeWithMockedOrgs }
export type { Organization, UserWithOrgsField }
