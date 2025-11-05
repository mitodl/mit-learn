"use client"

import React, { useEffect } from "react"
import DOMPurify from "isomorphic-dompurify"
import Image from "next/image"
import { useQueries, useQuery } from "@tanstack/react-query"
import {
  programsQueries,
  programCollectionQueries,
} from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { contractQueries } from "api/mitxonline-hooks/contracts"
import * as transform from "./CoursewareDisplay/transform"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { DashboardCard } from "./CoursewareDisplay/DashboardCard"
import {
  Link,
  PlainList,
  Skeleton,
  Stack,
  styled,
  Typography,
} from "ol-components"
import {
  DashboardProgram,
  DashboardProgramCollection,
  DashboardProgramCollectionProgram,
} from "./CoursewareDisplay/types"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import {
  ContractPage,
  CourseRunEnrollmentRequestV2,
  OrganizationPage,
  UserProgramEnrollmentDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiAwardFill } from "@remixicon/react"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"

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
          {org?.name}
        </Typography>
        {/* For now we will use the first contract name until we refactor this to be based on contracts / offerings */}
        <Typography variant="body1">{org?.contracts[0]?.name}</Typography>
      </Stack>
    </HeaderRoot>
  )
}

const WelcomeMessageExtra = styled(Typography)({
  margin: 0,
  p: {
    margin: 0,
  },
})

const WelcomeMessage: React.FC<{ org?: OrganizationPage }> = ({ org }) => {
  const [showingMore, setShowingMore] = React.useState(false)
  if (!org?.contracts || org.contracts.length === 0) {
    return null
  }
  const contract = org.contracts[0]
  const welcomeMessage = contract.welcome_message
  const welcomeMessageExtra = DOMPurify.sanitize(contract.welcome_message_extra)
  if (!welcomeMessage || !welcomeMessageExtra) {
    return null
  }
  return (
    <Stack gap="12px" paddingTop="40px" paddingBottom="24px">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body1">{welcomeMessage}</Typography>
        <Link
          scroll={false}
          color="red"
          size="small"
          onClick={() => setShowingMore(!showingMore)}
        >
          {showingMore ? "Show less" : "Show more"}
        </Link>
      </Stack>
      {showingMore && (
        <WelcomeMessageExtra
          variant="body1"
          dangerouslySetInnerHTML={{ __html: welcomeMessageExtra }}
        />
      )}
    </Stack>
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
  flexDirection: "row",
  justifyContent: "space-between",
  gap: "16px",
  backgroundColor: theme.custom.colors.white,
  borderRadius: "8px 8px 0px 0px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}))

const ProgramHeaderText = styled.div({
  flexDirection: "column",
  gap: "8px",
})

const ProgramCertificateButton = styled(ButtonLink)(({ theme }) => ({
  color: theme.custom.colors.red,
  display: "flex",
  width: "192px",
  height: "32px",
  padding: "12px 12px 12px 8px",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
}))

const ProgramDescription = styled(Typography)({
  p: {
    margin: 0,
  },
})

const ProgramCollectionsList = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

// Custom hook to handle multiple program queries and check if any have courses
const useProgramCollectionCourses = (
  programs: DashboardProgramCollectionProgram[],
  orgId: number,
) => {
  const programQueries = useQueries({
    queries: programs
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((program) =>
        programsQueries.programsList({ id: program.id, org_id: orgId }),
      ),
  })

  const isLoading = programQueries.some((query) => query.isLoading)

  const programsWithCourses = programQueries
    .map((query) => {
      if (!query.data?.results?.length) {
        return null
      }
      const program = query.data.results[0]
      const transformedProgram = transform.mitxonlineProgram(program)
      return {
        programId: query.data.results[0].id,
        program: transformedProgram,
        hasCourses: program.courses && program.courses.length > 0,
      }
    })
    .filter(Boolean)

  const hasAnyCourses = programsWithCourses.some((p) => p?.hasCourses)

  return {
    isLoading,
    programsWithCourses,
    hasAnyCourses,
  }
}

const OrgProgramCollectionDisplay: React.FC<{
  collection: DashboardProgramCollection
  contracts?: ContractPage[]
  enrollments?: CourseRunEnrollmentRequestV2[]
  orgId: number
}> = ({ collection, contracts, enrollments, orgId }) => {
  const sanitizedDescription = DOMPurify.sanitize(collection.description ?? "")
  const { isLoading, programsWithCourses, hasAnyCourses } =
    useProgramCollectionCourses(collection.programs, orgId)
  const firstCourseIds = programsWithCourses
    .map((p) => p?.program.courseIds[0])
    .filter((id): id is number => id !== undefined)
  const courses = useQuery({
    ...coursesQueries.coursesList({
      id: firstCourseIds,
      org_id: orgId,
    }),
    enabled: firstCourseIds.length > 0,
  })
  const rawCourses =
    courses.data?.results.sort((a, b) => {
      return firstCourseIds.indexOf(a.id) - firstCourseIds.indexOf(b.id)
    }) ?? []
  const transformedCourses = transform.organizationCoursesWithContracts({
    courses: rawCourses,
    contracts: contracts ?? [],
    enrollments: enrollments ?? [],
  })

  const header = (
    <ProgramHeader>
      <ProgramHeaderText>
        <Typography variant="h5" component="h2">
          {collection.title}
        </Typography>
        <ProgramDescription
          variant="body2"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      </ProgramHeaderText>
    </ProgramHeader>
  )

  if (isLoading) {
    return (
      <ProgramRoot data-testid="org-program-collection-root">
        {header}
        <PlainList>
          <Skeleton
            width="100%"
            height="65px"
            style={{ marginBottom: "16px" }}
          />
        </PlainList>
      </ProgramRoot>
    )
  }

  // Only render if at least one program has courses
  if (!hasAnyCourses) {
    return null
  }

  return (
    <ProgramRoot data-testid="org-program-collection-root">
      {header}
      <PlainList>
        {courses.isLoading &&
          programsWithCourses.map((item, index) => (
            <Skeleton
              key={`${collection.id}-${item?.programId}-${index}`}
              width="100%"
              height="65px"
              style={{ marginBottom: "16px" }}
            />
          ))}
        {transformedCourses.map((course) => (
          <DashboardCardStyled
            Component="li"
            key={course.key}
            dashboardResource={course}
            courseNoun="Module"
            offerUpgrade={false}
            titleAction="courseware"
            buttonHref={course.run?.coursewareUrl}
          />
        ))}
      </PlainList>
    </ProgramRoot>
  )
}

const OrgProgramDisplay: React.FC<{
  program: DashboardProgram
  contracts?: ContractPage[]
  courseRunEnrollments?: CourseRunEnrollmentRequestV2[]
  programEnrollments?: UserProgramEnrollmentDetail[]
  programLoading: boolean
  orgId: number
}> = ({
  program,
  contracts,
  courseRunEnrollments,
  programEnrollments,
  programLoading,
  orgId,
}) => {
  const programEnrollment = programEnrollments?.find(
    (enrollment) => enrollment.program.id === program.id,
  )
  const hasValidCertificate = !!programEnrollment?.certificate
  const courses = useQuery(
    coursesQueries.coursesList({
      id: program.courseIds,
      org_id: orgId,
      page_size: 30,
    }),
  )
  const skeleton = (
    <Skeleton width="100%" height="65px" style={{ marginBottom: "16px" }} />
  )
  if (programLoading || courses.isLoading) return skeleton
  const rawCourses =
    courses.data?.results.sort((a, b) => {
      return program.courseIds.indexOf(a.id) - program.courseIds.indexOf(b.id)
    }) ?? []
  const transformedCourses = transform.organizationCoursesWithContracts({
    courses: rawCourses,
    contracts: contracts ?? [],
    enrollments: courseRunEnrollments ?? [],
  })
  const sanitizedHtml = DOMPurify.sanitize(program.description)

  return (
    <ProgramRoot data-testid="org-program-root">
      <ProgramHeader>
        <ProgramHeaderText>
          <Typography variant="h5" component="h2">
            {program.title}
          </Typography>
          <ProgramDescription
            variant="body2"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </ProgramHeaderText>
        {hasValidCertificate && (
          <ProgramCertificateButton
            size="small"
            variant="bordered"
            startIcon={<RiAwardFill />}
            href={programEnrollment?.certificate?.link}
          >
            View {program.programType} Certificate
          </ProgramCertificateButton>
        )}
      </ProgramHeader>
      <PlainList>
        {transformedCourses.map((course) => (
          <DashboardCardStyled
            Component="li"
            key={course.key}
            dashboardResource={course}
            courseNoun="Module"
            offerUpgrade={false}
            titleAction="courseware"
            buttonHref={course.run?.coursewareUrl}
          />
        ))}
      </PlainList>
    </ProgramRoot>
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
  const orgId = org.id
  const contracts = useQuery(contractQueries.contractsList())
  const orgContracts = contracts.data?.filter(
    (contract) => contract.organization === orgId,
  )
  const courseRunEnrollments = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )
  const programEnrollments = useQuery(
    enrollmentQueries.programEnrollmentsList(),
  )
  const programs = useQuery(programsQueries.programsList({ org_id: orgId }))
  const programCollections = useQuery(
    programCollectionQueries.programCollectionsList({}),
  )

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
    <>
      <Stack>
        <OrganizationHeader org={org} />
        <WelcomeMessage org={org} />
      </Stack>
      <OrganizationRoot>
        {programs.isLoading || !transformedPrograms
          ? skeleton
          : transformedPrograms.map((program) => (
              <OrgProgramDisplay
                key={program.key}
                contracts={orgContracts}
                program={program}
                courseRunEnrollments={courseRunEnrollments.data}
                programEnrollments={programEnrollments.data}
                programLoading={programs.isLoading}
                orgId={orgId}
              />
            ))}
        {programCollections.isLoading ? (
          skeleton
        ) : (
          <ProgramCollectionsList>
            {programCollections.data?.results.map((collection) => {
              const transformedCollection =
                transform.mitxonlineProgramCollection(collection)
              return (
                <OrgProgramCollectionDisplay
                  key={collection.title}
                  collection={transformedCollection}
                  contracts={orgContracts}
                  enrollments={courseRunEnrollments.data}
                  orgId={orgId}
                />
              )
            })}
          </ProgramCollectionsList>
        )}
        {programs.data?.results.length === 0 && (
          <HeaderRoot>
            <Typography variant="h3" component="h1">
              No programs found
            </Typography>
          </HeaderRoot>
        )}
      </OrganizationRoot>
    </>
  )
}

const matchOrganizationBySlug =
  (orgSlug: string) => (organization: OrganizationPage) => {
    return organization.slug.replace("org-", "") === orgSlug
  }

type OrganizationContentProps = {
  orgSlug: string
}
const OrganizationContent: React.FC<OrganizationContentProps> = ({
  orgSlug,
}) => {
  const { isLoading: isLoadingMitxOnlineUser, data: mitxOnlineUser } = useQuery(
    mitxUserQueries.me(),
  )

  useEffect(() => {
    if (
      mitxOnlineUser?.b2b_organizations.find(matchOrganizationBySlug(orgSlug))
    ) {
      localStorage.setItem("last-dashboard-org", orgSlug)
    }
  }, [mitxOnlineUser, orgSlug])

  if (isLoadingMitxOnlineUser) {
    return (
      <Skeleton width="100%" height="100px" style={{ marginBottom: "16px" }} />
    )
  }

  const b2bOrganization = mitxOnlineUser?.b2b_organizations.find(
    matchOrganizationBySlug(orgSlug),
  )

  if (!b2bOrganization) {
    return <ErrorContent title="Organization not found" timSays="404" />
  }

  return <OrganizationContentInternal org={b2bOrganization} />
}

export default OrganizationContent

export type { OrganizationContentProps }
