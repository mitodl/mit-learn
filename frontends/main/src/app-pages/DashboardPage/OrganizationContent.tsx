"use client"

import React from "react"
import { User, useUserMe } from "api/hooks/user"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useQueries, useQuery, UseQueryResult } from "@tanstack/react-query"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { V2Program } from "api/mitxonline"
import * as transform from "./CoursewareDisplay/transform"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { DashboardCard } from "./CoursewareDisplay/DashboardCard"
import { PlainList, styled } from "ol-components"

const DashboardCardStyled = styled(DashboardCard)({
  borderRadius: "0px",
  "&:not(:first-child)": {
    borderTop: "none",
  },
})

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

const useMitxonlineProgramsCourses = (programs: V2Program[]) => {
  const courseGroupIds =
    programs.map((program) => program.courses.map((id) => id as number)) ?? []

  const courseGroups = useQueries({
    queries: courseGroupIds.map((courseIds) =>
      coursesQueries.coursesList({ id: courseIds }),
    ),
  })

  return courseGroups
}

type OrganizationContentProps = {
  orgId: number
}
const OrganizationContent: React.FC<OrganizationContentProps> = ({ orgId }) => {
  const user = useUserMeWithMockedOrgs()
  const organization = user.data?.organizations.find((org) => org.id === orgId)
  console.log({ organization })
  const enrollments = useQuery(enrollmentQueries.coursesList({ orgId }))
  const programs = useQuery(programsQueries.programsList({ orgId }))
  const courseGroups = useMitxonlineProgramsCourses(
    programs.data?.results ?? [],
  )

  const transformedCourseGroups = courseGroups.map((courseGroup) => {
    if (!courseGroup.data || !enrollments.data) return []
    return transform.mitxonlineCourses({
      courses: courseGroup.data?.results ?? [],
      enrollments: enrollments.data ?? [],
    })
  })
  const transformedPrograms = programs.data?.results.map((program) =>
    transform.mitxonlineProgram(program),
  )

  return (
    <div>
      {programs.isLoading ? (
        "Programs Loading"
      ) : (
        <ul>
          {transformedPrograms?.map((program, index) => (
            <li key={program.id}>
              <strong>{program.title}</strong>
              <ul>
                {courseGroups[index].isLoading ? (
                  "Courses Loading"
                ) : (
                  <PlainList itemSpacing={0}>
                    {transformedCourseGroups[index].map((course) => (
                      <DashboardCardStyled
                        Component="li"
                        key={course.id}
                        dashboardResource={course}
                      />
                    ))}
                  </PlainList>
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
