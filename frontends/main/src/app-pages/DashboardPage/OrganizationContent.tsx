"use client"

import React from "react"
import Image from "next/image"
import { User, useUserMe } from "api/hooks/user"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useQueries, useQuery, UseQueryResult } from "@tanstack/react-query"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { V2Program } from "api/mitxonline"

import { Stack, styled, Typography } from "ol-components"

import graduateLogo from "@/public/images/dashboard/graduate.png"

type Organization = { id: number; name: string; logo?: string }
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
        {
          id: 522,
          name: "Organization Y",
          logo: "https://brand.mit.edu/sites/default/files/styles/tile_narrow/public/2023-08/logo-colors-mit-red.png?itok=k08Ir4pB",
        },
      ]
    : []
  return { ...query, data: { ...query.data, organizations } }
}

const HeaderRoot = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "24px",
})
const ImageContainer = styled.div(({ theme }) => ({
  width: "120px",
  height: "118px",
  padding: "0 24px",
  display: "flex",
  alignItems: "center",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0px 1px 3px 0px rgba(120, 147, 172, 0.40)",
  "> img": {
    width: "100%",
    height: "auto",
  },
}))
const OrganizationHeader: React.FC<{ org: Organization }> = ({ org }) => {
  return (
    <HeaderRoot>
      <ImageContainer>
        <Image
          width={72}
          // NextJS Image component requires width and height to avoid loayout shift.
          // These are supposed to be the intrinsic sizes of the image file.
          // That said, it's not particularly relevant here since the parent is
          // reserving spae for the image anyway. Using next/image still gets us
          // the image optimization, though.
          height={78}
          src={org.logo ?? graduateLogo}
          alt=""
        />
      </ImageContainer>
      <Stack gap="8px">
        <Typography variant="h3" component="h1">
          Your {org.name} Home
        </Typography>
        <Typography variant="body1">MIT courses for {org.name}</Typography>
      </Stack>
    </HeaderRoot>
  )
}

/**
 * For an array of programs, fetch the associated courses.
 * [program1, program2] => [[...courses1], [...courses2]]
 */
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

const OrganizationRoot = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

type OrganizationContentProps = {
  orgId: number
}
const OrganizationContent: React.FC<OrganizationContentProps> = ({ orgId }) => {
  const user = useUserMeWithMockedOrgs()

  const programs = useQuery(programsQueries.programsList({ orgId }))
  const courseGroups = useMitxonlineProgramsCourses(
    programs.data?.results ?? [],
  )

  if (user.isLoading) return "Loading"
  const organization = user.data?.organizations.find((org) => org.id === orgId)
  if (!organization) return null

  return (
    <OrganizationRoot>
      <OrganizationHeader org={organization} />
      {programs.isLoading
        ? "Programs Loading"
        : programs.data?.results?.map((program, index) => {
            return (
              <div key={program.id}>
                <h3>
                  {program.title} ({program.courses.length})
                  <ul>
                    {courseGroups[index].isLoading
                      ? "Loading courses"
                      : courseGroups[index].data?.results.map((course) => {
                          return <li key={course.id}>{course.title}</li>
                        })}
                  </ul>
                </h3>
              </div>
            )
          })}
    </OrganizationRoot>
  )
}

export default OrganizationContent

export type { OrganizationContentProps }

// To be removed
export { useUserMeWithMockedOrgs }
export type { Organization, UserWithOrgsField }
