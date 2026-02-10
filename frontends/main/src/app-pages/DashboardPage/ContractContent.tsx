"use client"

import React, { useEffect } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import {
  programsQueries,
  programCollectionQueries,
} from "api/mitxonline-hooks/programs"
import { coursesQueries } from "api/mitxonline-hooks/courses"
import { enrollmentQueries } from "api/mitxonline-hooks/enrollment"
import { DashboardCard, DashboardType } from "./CoursewareDisplay/DashboardCard"
import {
  Link,
  PlainList,
  Skeleton,
  Stack,
  styled,
  Typography,
} from "ol-components"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import {
  CourseRunEnrollmentRequestV2,
  ContractPage,
  OrganizationPage,
  V2ProgramCollection,
  V2Program,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiAwardFill } from "@remixicon/react"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import { matchOrganizationBySlug } from "@/common/utils"
import {
  ResourceType,
  getKey,
  selectBestEnrollment,
} from "./CoursewareDisplay/helpers"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"

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

const ContractHeader: React.FC<{
  org?: OrganizationPage
  contract?: ContractPage
}> = ({ org, contract }) => {
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
        <Typography variant="body1">{contract?.name}</Typography>
      </Stack>
    </HeaderRoot>
  )
}

const WelcomeMessageExtra = styled(UnstyledRawHTML)(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  "*:first-child": {
    marginTop: 0,
  },
  "*:last-child": {
    marginBottom: 0,
  },
  iframe: {
    width: "100%",
    aspectRatio: "16 / 9",
    border: "none",
  },
}))

const WelcomeMessage: React.FC<{ contract?: ContractPage }> = ({
  contract,
}) => {
  const empty = <Stack height="40px" />
  const [showingMore, setShowingMore] = React.useState(false)
  if (!contract) {
    return empty
  }
  const welcomeMessage = contract.welcome_message
  const welcomeMessageExtra = contract.welcome_message_extra
  if (!welcomeMessage || !welcomeMessageExtra) {
    return empty
  }
  return (
    <Stack gap="12px" paddingTop="40px" paddingBottom="24px">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">{welcomeMessage}</Typography>
        <Link
          scroll={false}
          color="red"
          size="small"
          onClick={() => setShowingMore(!showingMore)}
        >
          {showingMore ? "Show less" : "Show more"}
        </Link>
      </Stack>
      {showingMore && <WelcomeMessageExtra html={welcomeMessageExtra} />}
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

const ProgramDescription = styled(UnstyledRawHTML)(({ theme }) => ({
  ...theme.typography.body2,
  p: {
    margin: 0,
  },
}))

const ProgramCollectionsList = styled(PlainList)({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

// Custom hook to handle multiple program queries and check if any have courses
const useProgramCollectionCourses = (
  programCollection: V2ProgramCollection,
  contractId: number,
) => {
  const programIds = programCollection.programs
    .map((program) => program.id)
    .filter((id) => id !== undefined)
  const programsQuery = useQuery({
    ...programsQueries.programsList({
      id: programIds,
      contract_id: contractId,
    }),
    enabled: programIds.length > 0,
  })
  const isLoading = programsQuery.isLoading

  const programsWithCourses = programsQuery.data?.results.map((program) => {
    return {
      programId: program.id,
      program: program,
      hasCourses: program.courses && program.courses.length > 0,
    }
  })

  const hasAnyCourses = programsQuery.data?.results.some(
    (p) => p?.courses && p.courses.length > 0,
  )

  return {
    isLoading,
    programsWithCourses,
    hasAnyCourses,
  }
}

const OrgProgramCollectionDisplay: React.FC<{
  collection: V2ProgramCollection
  contract: ContractPage
  enrollments?: CourseRunEnrollmentRequestV2[]
}> = ({ collection, contract, enrollments }) => {
  const { isLoading, programsWithCourses, hasAnyCourses } =
    useProgramCollectionCourses(collection, contract.id)
  const firstCourseIds = programsWithCourses
    ?.map((p) => p?.program.courses[0])
    .filter((id): id is number => id !== undefined)
  const courses = useQuery({
    ...coursesQueries.coursesList({
      id: firstCourseIds,
      contract_id: contract.id,
    }),
    enabled: firstCourseIds !== undefined && firstCourseIds.length > 0,
  })
  // Create mapping from course ID to program order
  const courseIdToOrder = new Map<number, number>()
  programsWithCourses?.forEach((item) => {
    const firstCourseId = item.program.courses[0]
    const programId = item.programId
    const order =
      collection.programs.find((p) => p.id === programId)?.order ?? Infinity
    courseIdToOrder.set(firstCourseId, order)
  })
  const rawCourses =
    courses.data?.results.sort((a, b) => {
      const orderA = courseIdToOrder.get(a.id) ?? Infinity
      const orderB = courseIdToOrder.get(b.id) ?? Infinity
      return orderA - orderB
    }) ?? []

  const header = (
    <ProgramHeader>
      <ProgramHeaderText>
        <Typography variant="h5" component="h2">
          {collection.title}
        </Typography>
        <ProgramDescription html={collection.description ?? ""} />
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
          programsWithCourses?.map((item, index) => (
            <Skeleton
              key={`${collection.id}-${item?.programId}-${index}`}
              width="100%"
              height="65px"
              style={{ marginBottom: "16px" }}
            />
          ))}
        {rawCourses.map((course) => {
          // Filter enrollments to only those matching this contract
          const contractEnrollments =
            enrollments?.filter(
              (enrollment) => enrollment.b2b_contract_id === contract.id,
            ) ?? []
          const bestEnrollment = selectBestEnrollment(
            course,
            contractEnrollments,
          )
          return (
            <DashboardCardStyled
              Component="li"
              key={getKey({
                resourceType: ResourceType.Course,
                id: course.id,
                runId: bestEnrollment?.run.id,
              })}
              resource={
                bestEnrollment
                  ? {
                      type: DashboardType.CourseRunEnrollment,
                      data: bestEnrollment,
                    }
                  : { type: DashboardType.Course, data: course }
              }
              noun="Module"
              offerUpgrade={false}
              buttonHref={bestEnrollment?.run.courseware_url}
              contractId={contract.id}
            />
          )
        })}
      </PlainList>
    </ProgramRoot>
  )
}

const OrgProgramDisplay: React.FC<{
  program: V2Program
  contract?: ContractPage
  courseRunEnrollments?: CourseRunEnrollmentRequestV2[]
  programEnrollments?: V3UserProgramEnrollment[]
  programLoading: boolean
  orgId: number
}> = ({
  program,
  contract,
  courseRunEnrollments,
  programEnrollments,
  programLoading,
  orgId: _orgId,
}) => {
  const programEnrollment = programEnrollments?.find(
    (enrollment) => enrollment.program.id === program.id,
  )
  const hasValidCertificate = !!programEnrollment?.certificate
  const coursesQuery = useQuery(
    coursesQueries.coursesList({
      id: program.courses,
      contract_id: contract?.id,
      page_size: 30,
    }),
  )
  const skeleton = (
    <Skeleton width="100%" height="65px" style={{ marginBottom: "16px" }} />
  )

  const courses =
    coursesQuery.data?.results.sort((a, b) => {
      return program.courses.indexOf(a.id) - program.courses.indexOf(b.id)
    }) ?? []

  return (
    <ProgramRoot data-testid="org-program-root">
      <ProgramHeader>
        <ProgramHeaderText>
          <Typography variant="h5" component="h2">
            {program.title}
          </Typography>
          <ProgramDescription html={program.page.description ?? ""} />
        </ProgramHeaderText>
        {hasValidCertificate && (
          <ProgramCertificateButton
            size="small"
            variant="bordered"
            startIcon={<RiAwardFill />}
            href={`/certificate/program/${programEnrollment?.certificate?.uuid}/`}
          >
            View {program.program_type} Certificate
          </ProgramCertificateButton>
        )}
      </ProgramHeader>
      <PlainList>
        {programLoading || coursesQuery.isLoading
          ? skeleton
          : courses.map((course) => {
              // Filter enrollments to only those matching this contract
              const contractEnrollments =
                courseRunEnrollments?.filter(
                  (enrollment) => enrollment.b2b_contract_id === contract?.id,
                ) ?? []
              const bestEnrollment = selectBestEnrollment(
                course,
                contractEnrollments,
              )

              return (
                <DashboardCardStyled
                  Component="li"
                  key={getKey({
                    resourceType: ResourceType.Course,
                    id: course.id,
                    runId: bestEnrollment?.run.id,
                  })}
                  resource={
                    bestEnrollment
                      ? {
                          type: DashboardType.CourseRunEnrollment,
                          data: bestEnrollment,
                        }
                      : { type: DashboardType.Course, data: course }
                  }
                  noun="Module"
                  offerUpgrade={false}
                  buttonHref={bestEnrollment?.run.courseware_url}
                  contractId={contract?.id}
                />
              )
            })}
      </PlainList>
    </ProgramRoot>
  )
}

const ContractRoot = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

type ContractContentInternalProps = {
  org: OrganizationPage
  contract: ContractPage
}
const ContractContentInternal: React.FC<ContractContentInternalProps> = ({
  org,
  contract,
}) => {
  const orgId = org.id
  const courseRunEnrollmentsQuery = useQuery(
    enrollmentQueries.courseRunEnrollmentsList(),
  )
  const programEnrollmentsQuery = useQuery(
    enrollmentQueries.programEnrollmentsList(),
  )
  const programsQuery = useQuery(
    programsQueries.programsList({ org_id: orgId, contract_id: contract.id }),
  )
  const programCollectionsQuery = useQuery(
    programCollectionQueries.programCollectionsList({}),
  )
  const coursesQuery = useQuery(
    coursesQueries.coursesList({
      org_id: orgId,
      contract_id: contract.id,
      page_size: 200,
    }),
  )

  // Helper to check if a program has any courses with contract-scoped runs
  const programHasContractRuns = (programId: number): boolean => {
    const programData = programsQuery.data?.results.find(
      (p) => p.id === programId,
    )
    if (!programData?.courses || !coursesQuery.data?.results) return false
    // Since courses query is already filtered by contract_id,
    // we just need to check if any of the program's courses exist in the results
    return programData.courses.some((courseId) =>
      coursesQuery.data.results.some((c) => c.id === courseId),
    )
  }

  // Get IDs of all programs that are in collections
  const programsInCollections = new Set(
    programCollectionsQuery.data?.results.flatMap((collection) =>
      collection.programs.map((p) => p.id),
    ) ?? [],
  )

  const sortedPrograms = programsQuery.data?.results
    .filter((program) => !programsInCollections.has(program.id))
    .filter(() => {
      // If contract has no programs defined, show nothing
      return contract?.programs && contract.programs.length > 0
    })
    .filter((program) => {
      // Only include programs that are in the contract
      return contract?.programs.includes(program.id)
    })
    .filter((program) => programHasContractRuns(program.id))
    .sort((a, b) => {
      if (!contract?.programs) return 0
      const indexA = contract.programs.indexOf(a.id)
      const indexB = contract.programs.indexOf(b.id)
      return indexA - indexB
    })

  const skeleton = (
    <Stack gap="16px">
      <Skeleton width="100%" height="65px" />
      <Skeleton width="100%" height="65px" />
      <Skeleton width="100%" height="65px" />
    </Stack>
  )

  // Wait for all program and collection data to load
  if (programsQuery.isLoading || programCollectionsQuery.isLoading) {
    return (
      <>
        <Stack>
          <ContractHeader org={org} contract={contract} />
          <WelcomeMessage contract={contract} />
        </Stack>
        {skeleton}
      </>
    )
  }

  return (
    <>
      <Stack>
        <ContractHeader org={org} contract={contract} />
        <WelcomeMessage contract={contract} />
      </Stack>
      <ContractRoot>
        {!sortedPrograms
          ? skeleton
          : sortedPrograms.map((program) => (
              <OrgProgramDisplay
                key={getKey({
                  resourceType: ResourceType.Program,
                  id: program.id,
                })}
                contract={contract}
                program={program}
                courseRunEnrollments={courseRunEnrollmentsQuery.data}
                programEnrollments={programEnrollmentsQuery.data}
                programLoading={programsQuery.isLoading}
                orgId={orgId}
              />
            ))}
        <ProgramCollectionsList>
          {(programCollectionsQuery.data?.results ?? [])
            .filter(() => {
              // If contract has no programs defined, show nothing
              return contract?.programs && contract.programs.length > 0
            })
            .filter((collection) => {
              // Only show collections where at least one program is in the contract
              const collectionProgramIds = collection.programs.map((p) => p.id)
              return collectionProgramIds.some(
                (id) => id !== undefined && contract?.programs.includes(id),
              )
            })
            .filter((collection) => {
              // Filter out collections where none of the programs have valid course runs
              const collectionProgramIds = collection.programs
                .map((p) => p.id)
                .filter((id): id is number => id !== undefined)
              return collectionProgramIds.some((id) =>
                programHasContractRuns(id),
              )
            })
            .map((collection) => {
              return (
                <OrgProgramCollectionDisplay
                  key={getKey({
                    resourceType: ResourceType.ProgramCollection,
                    id: collection.id,
                  })}
                  collection={collection}
                  contract={contract}
                  enrollments={courseRunEnrollmentsQuery.data}
                />
              )
            })}
        </ProgramCollectionsList>
        {programsQuery.data?.results.length === 0 && (
          <HeaderRoot>
            <Typography variant="h3" component="h1">
              No programs found
            </Typography>
          </HeaderRoot>
        )}
      </ContractRoot>
    </>
  )
}

type ContractContentProps = {
  orgSlug: string
  contractSlug: string
}
const ContractContent: React.FC<ContractContentProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const { isLoading: isLoadingMitxOnlineUser, data: mitxOnlineUser } = useQuery(
    mitxUserQueries.me(),
  )

  const b2bOrganization = mitxOnlineUser?.b2b_organizations.find(
    matchOrganizationBySlug(orgSlug),
  )
  const b2bContract = b2bOrganization?.contracts.find(
    (contract) => contract.slug === contractSlug,
  )

  useEffect(() => {
    if (b2bOrganization) {
      localStorage.setItem("last-dashboard-org", orgSlug)
    }
  }, [b2bOrganization, orgSlug])

  useEffect(() => {
    if (b2bContract) {
      localStorage.setItem("last-dashboard-contract", contractSlug)
    }
  }, [b2bContract, contractSlug])

  if (isLoadingMitxOnlineUser) {
    return (
      <Skeleton width="100%" height="100px" style={{ marginBottom: "16px" }} />
    )
  }

  if (!b2bOrganization) {
    return <ErrorContent title="Organization not found" timSays="404" />
  }

  if (!b2bContract) {
    return <ErrorContent title="Contract not found" timSays="404" />
  }

  return (
    <ContractContentInternal org={b2bOrganization} contract={b2bContract} />
  )
}

export default ContractContent

export type { ContractContentProps }
