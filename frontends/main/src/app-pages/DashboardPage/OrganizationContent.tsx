"use client"

import React from "react"
import { User, useUserMe } from "api/hooks/user"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useQueries, useQuery, UseQueryResult } from "@tanstack/react-query"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"

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
  const user = useUserMeWithMockedOrgs()
  const organization = user.data?.organizations.find((org) => org.id === orgId)
  console.log({ organization })
  const programs = useQuery(programsQueries.programsList({ orgId }))
  const courseGroupIds =
    programs.data?.results.map((program) =>
      program.courses.map((id) => id as number),
    ) ?? []
  console.log(courseGroupIds)
  const courseGroups = useQueries({
    queries: courseGroupIds.map((courseIds) =>
      coursesQueries.coursesList({ id: courseIds }),
    ),
  })

  return (
    <div>
      {programs.isLoading ? (
        "Programs Loading"
      ) : (
        <ul>
          {programs.data?.results.map((program, index) => (
            <li key={program.id}>
              <strong>{program.title}</strong>
              <ul>
                {courseGroups[index].isLoading ? (
                  "Courses Loading"
                ) : (
                  <ul>
                    {courseGroups[index].data?.results.map((course) => (
                      <li key={course.id}>{course.title}</li>
                    ))}
                  </ul>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OrganizationContent

export type { OrganizationContentProps }

// To be removed
export { useUserMeWithMockedOrgs }
export type { Organization, UserWithOrgsField }
