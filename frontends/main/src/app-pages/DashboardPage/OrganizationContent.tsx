"use client"

import React from "react"
import Image from "next/image"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useQuery } from "@tanstack/react-query"
import {
  programsQueries,
  programCollectionQueries,
} from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import * as transform from "./CoursewareDisplay/transform"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { DashboardCard } from "./CoursewareDisplay/DashboardCard"
import { PlainList, Skeleton, Stack, styled, Typography } from "ol-components"
import {
  DashboardProgram,
  DashboardProgramCollection,
} from "./CoursewareDisplay/types"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import {
  CourseRunEnrollment,
  OrganizationPage,
} from "@mitodl/mitxonline-api-axios/v1"
import { useMitxOnlineCurrentUser } from "api/mitxonline-hooks/user"

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
const OrganizationHeader: React.FC<{ org?: OrganizationPage }> = ({ org }) => {
  return (
    <HeaderRoot>
      <ImageContainer>
        <Image
          width={72}
          // NextJS Image component requires width and height to avoid layout shift.
          // These are supposed to be the intrinsic sizes of the image file.
          // That said, it's not particularly relevant here since the parent is
          // reserving space for the image anyway. Using next/image still gets us
          // the image optimization, though.
          height={78}
          src={org?.logo ?? graduateLogo}
          alt=""
        />
      </ImageContainer>
      <Stack gap="8px">
        <Typography variant="h3" component="h1">
          Your {org?.name} Home
        </Typography>
        <Typography variant="body1">MIT courses for {org?.name}</Typography>
      </Stack>
    </HeaderRoot>
  )
}

const DashboardCardStyled = styled(DashboardCard)({
  borderRadius: "0px",
  borderTop: "none",
  "&:last-of-type": {
    borderRadius: "0px 0px 8px 8px",
  },
})
const ProgramRoot = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  backgroundColor: theme.custom.colors.white,
  borderRadius: "8px",
}))
const ProgramHeader = styled.div(({ theme }) => ({
  display: "flex",
  padding: "24px",
  flexDirection: "column",

  gap: "16px",
  backgroundColor: "rgba(243, 244, 248, 0.60)", // lightGray1 at 60%
  borderRadius: "8px 8px 0px 0px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const OrgProgramCollectionDisplay: React.FC<{
  collection: DashboardProgramCollection
  enrollments?: CourseRunEnrollment[]
  orgId: number
}> = ({ collection, enrollments, orgId }) => {
  return (
    <ProgramRoot data-testid="org-program-collection-root">
      <ProgramHeader>
        <Typography variant="h5" component="h2">
          {collection.title}
        </Typography>
      </ProgramHeader>
      <PlainList itemSpacing={0}>
        {collection.programIds.map((programId) => (
          <ProgramCard
            key={programId}
            programId={programId}
            enrollments={enrollments}
            orgId={orgId}
          />
        ))}
      </PlainList>
    </ProgramRoot>
  )
}

const OrgProgramDisplay: React.FC<{
  program: DashboardProgram
  enrollments?: CourseRunEnrollment[]
  programLoading: boolean
}> = ({ program, enrollments, programLoading }) => {
  const courses = useQuery(
    coursesQueries.coursesList({ id: program.courseIds }),
  )
  const skeleton = (
    <Skeleton width="100%" height="65px" style={{ marginBottom: "16px" }} />
  )
  if (programLoading || courses.isLoading) return skeleton
  const transformedCourses = transform.mitxonlineCourses({
    courses: courses.data?.results ?? [],
    enrollments: enrollments ?? [],
  })

  return (
    <ProgramRoot data-testid="org-program-root">
      <ProgramHeader>
        <Typography variant="h5" component="h2">
          {program.title}
        </Typography>
        <Typography variant="body1">{program.description}</Typography>
      </ProgramHeader>
      <PlainList itemSpacing={0}>
        {transform
          .sortDashboardCourses(program, transformedCourses)
          .map((course) => (
            <DashboardCardStyled
              Component="li"
              key={course.key}
              dashboardResource={course}
              courseNoun="Module"
              offerUpgrade={false}
              titleHref={course.run?.coursewareUrl}
              buttonHref={course.run?.coursewareUrl}
            />
          ))}
      </PlainList>
    </ProgramRoot>
  )
}

const ProgramCard: React.FC<{
  programId: number
  enrollments?: CourseRunEnrollment[]
  orgId: number
}> = ({ programId, enrollments, orgId }) => {
  const program = useQuery(
    programsQueries.programsList({ id: programId, org_id: orgId }),
  )
  const courses = useQuery(
    coursesQueries.coursesList({
      id: program.data?.results[0]?.courses,
      org_id: orgId,
    }),
  )
  const skeleton = (
    <Skeleton width="100%" height="65px" style={{ marginBottom: "16px" }} />
  )
  if (program.isLoading || !program.data?.results.length) return skeleton
  if (courses.isLoading) return skeleton
  const transformedProgram = transform.mitxonlineProgram(
    program.data?.results[0] ?? {},
  )
  const transformedCourses = transform.mitxonlineCourses({
    courses: courses.data?.results ?? [],
    enrollments: enrollments ?? [],
  })
  if (courses.isLoading || !transformedCourses.length) return skeleton
  // For now we assume the first course is the main one for the program.
  const course = transformedCourses[0]
  return (
    <DashboardCard
      Component="li"
      key={transformedProgram.key}
      dashboardResource={course}
      courseNoun={"Course"}
      offerUpgrade={false}
      titleHref={course.run.coursewareUrl ?? ""}
      buttonHref={course.run.coursewareUrl ?? ""}
    />
  )
}

const OrganizationRoot = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

type OrganizationContentInternalProps = {
  org: OrganizationPage
}
const OrganizationContentInternal: React.FC<
  OrganizationContentInternalProps
> = ({ org }) => {
  const isOrgDashboardEnabled = useFeatureFlagEnabled(
    FeatureFlags.OrganizationDashboard,
  )
  const orgId = org.id
  const enrollments = useQuery(enrollmentQueries.enrollmentsList())
  const programs = useQuery(programsQueries.programsList({ org_id: orgId }))
  const programCollections = useQuery(
    programCollectionQueries.programCollectionsList({}),
  )

  if (!isOrgDashboardEnabled) return null

  const transformedPrograms = programs.data?.results
    .filter((program) => program.collections.length === 0)
    .map((program) => transform.mitxonlineProgram(program))

  const skeleton = (
    <Stack gap="16px">
      <Skeleton width="100%" height="65px" />
      <Skeleton width="100%" height="65px" />
      <Skeleton width="100%" height="65px" />
    </Stack>
  )

  return (
    <OrganizationRoot>
      <OrganizationHeader org={org} />
      {programs.isLoading || !transformedPrograms
        ? skeleton
        : transformedPrograms.map((program) => (
            <OrgProgramDisplay
              key={program.key}
              program={program}
              enrollments={enrollments.data}
              programLoading={programs.isLoading}
            />
          ))}
      {programCollections.isLoading ? (
        skeleton
      ) : (
        <PlainList itemSpacing={0}>
          {programCollections.data?.results.map((collection) => {
            const transformedCollection =
              transform.mitxonlineProgramCollection(collection)
            return (
              <OrgProgramCollectionDisplay
                key={collection.title}
                collection={transformedCollection}
                enrollments={enrollments.data}
                orgId={orgId}
              />
            )
          })}
        </PlainList>
      )}
    </OrganizationRoot>
  )
}

type OrganizationContentProps = {
  orgSlug: string
}
const OrganizationContent: React.FC<OrganizationContentProps> = ({
  orgSlug,
}) => {
  const { isLoading: isLoadingMitxOnlineUser, data: mitxOnlineUser } =
    useMitxOnlineCurrentUser()
  const b2bOrganization = mitxOnlineUser?.b2b_organizations.find(
    (org) => org.slug.replace("org-", "") === orgSlug,
  )
  const skeleton = (
    <Skeleton width="100%" height="100px" style={{ marginBottom: "16px" }} />
  )
  if (isLoadingMitxOnlineUser || isLoadingMitxOnlineUser) return skeleton
  return b2bOrganization ? (
    <OrganizationContentInternal org={b2bOrganization} />
  ) : null
}

export default OrganizationContent

export type { OrganizationContentProps }
