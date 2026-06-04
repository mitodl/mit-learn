"use client"

import React, { useEffect } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { DashboardCard } from "./CoursewareDisplay/DashboardCard"
import { adaptCourseEntryToLegacyDashboardCardProps } from "./CoursewareDisplay/model/dashboardAdapters"
import {
  Link,
  PlainList,
  Skeleton,
  Stack,
  styled,
  Typography,
} from "ol-components"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import type {
  ContractPage,
  OrganizationPage,
  V2ProgramCollection,
  V2Program,
  V3UserProgramEnrollment,
} from "@mitodl/mitxonline-api-axios/v2"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { ButtonLink } from "@mitodl/smoot-design"
import { RiAwardFill } from "@remixicon/react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import { matchOrganizationBySlug } from "@/common/utils"
import { FeatureFlags } from "@/common/feature_flags"
import { contractAdminView } from "@/common/urls"
import { ResourceType, getKey } from "./CoursewareDisplay/helpers"
import type { DashboardCourseEntry } from "./CoursewareDisplay/model/dashboardViewModel"
import { useContractDashboardData } from "./CoursewareDisplay/hooks/useContractDashboardData"
import UnstyledRawHTML from "@/components/UnstyledRawHTML/UnstyledRawHTML"
import { VariantPicker } from "./CoursewareDisplay/VariantPicker"

const HeaderRoot = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    padding: "0 16px",
    gap: "16px",
  },
}))

const ImageContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "80px",
  height: "80px",
  padding: "16px",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0px 1px 3px 0px rgba(120, 147, 172, 0.40)",
  "> img": {
    width: "100%",
    height: "auto",
  },
  [theme.breakpoints.down("sm")]: {
    width: "56px",
    height: "56px",
    padding: "8px",
  },
}))

const HeaderTextContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    gap: "0px",
  },
}))

const HeaderText = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
  },
})) as typeof Typography

const SubHeaderText = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle2,
  },
})) as typeof Typography

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
      <HeaderTextContainer>
        <HeaderText component="h1">{org?.name}</HeaderText>
        <SubHeaderText>{contract?.name}</SubHeaderText>
      </HeaderTextContainer>
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
        <Typography variant="h5" component="h2">
          {welcomeMessage}
        </Typography>
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
    padding: "16px",
    backgroundColor: theme.custom.colors.lightGray1,
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  },
}))

const ProgramHeaderText = styled.div(({ theme }) => ({
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    gap: "0",
  },
}))

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

const ProgramControls = styled.div(({ theme }) => ({
  display: "flex",
  gap: "12px",
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const OrgProgramCollectionDisplay: React.FC<{
  collection: V2ProgramCollection
  entries: DashboardCourseEntry[]
}> = ({ collection, entries }) => {
  const header = (
    <ProgramHeader>
      <ProgramHeaderText>
        <Typography variant="subtitle1" component="h2">
          {collection.title}
        </Typography>
        <ProgramDescription html={collection.description ?? ""} />
      </ProgramHeaderText>
    </ProgramHeader>
  )

  if (entries.length === 0) {
    return null
  }

  return (
    <ProgramRoot data-testid="org-program-collection-root">
      {header}
      <PlainList>
        {entries.map((entry) => (
          <DashboardCardStyled
            Component="li"
            key={getKey({
              resourceType: ResourceType.Course,
              id: entry.course.id,
              runId:
                entry.displayedEnrollment?.run.id ?? entry.displayedRun?.id,
            })}
            {...adaptCourseEntryToLegacyDashboardCardProps(entry)}
            noun="Module"
            offerUpgrade={false}
          />
        ))}
      </PlainList>
    </ProgramRoot>
  )
}

const OrgProgramDisplay: React.FC<{
  program: V2Program
  entries: DashboardCourseEntry[]
  programEnrollment?: V3UserProgramEnrollment
}> = ({ program, entries, programEnrollment }) => {
  const hasValidCertificate = !!programEnrollment?.certificate

  if (entries.length === 0) {
    return null
  }

  return (
    <ProgramRoot data-testid="org-program-root">
      <ProgramHeader>
        <ProgramHeaderText>
          <Typography variant="subtitle1" component="h2">
            {program.title}
          </Typography>
          <ProgramDescription html={program.page?.description ?? ""} />
        </ProgramHeaderText>
        {hasValidCertificate && (
          <ProgramControls>
            <ProgramCertificateButton
              size="small"
              variant="bordered"
              startIcon={<RiAwardFill />}
              href={`/certificate/program/${programEnrollment?.certificate?.uuid}/`}
            >
              {`View ${program.program_type ? `${program.program_type} ` : ""}Certificate`}
            </ProgramCertificateButton>
          </ProgramControls>
        )}
      </ProgramHeader>
      <PlainList>
        {entries.map((entry) => (
          <DashboardCardStyled
            Component="li"
            key={getKey({
              resourceType: ResourceType.Course,
              id: entry.course.id,
              runId:
                entry.displayedEnrollment?.run.id ?? entry.displayedRun?.id,
            })}
            {...adaptCourseEntryToLegacyDashboardCardProps(entry)}
            noun="Module"
            offerUpgrade={false}
          />
        ))}
      </PlainList>
    </ProgramRoot>
  )
}

const ContractRoot = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
})

const ContractHeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  padding: "24px",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 1px 6px 0 rgba(3, 21, 45, 0.05)",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "16px",
    padding: "16px 0 0 0",
  },
}))

const ManageButtonWrapper = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    padding: "0 16px 16px",
    "> a": {
      width: "100%",
    },
  },
}))

type ContractContentInternalProps = {
  org: OrganizationPage
  contract: ContractPage
}
const ContractContentInternal: React.FC<ContractContentInternalProps> = ({
  org,
  contract,
}) => {
  const {
    isLoading,
    showNoPrograms,
    variantOptions,
    selectedVariant,
    setSelectedVariant,
    programs,
    collections,
  } = useContractDashboardData(org, contract)

  const managerDashboardFlag = useFeatureFlagEnabled(
    FeatureFlags.B2BContractManagerDashboard,
  )
  const { data: managerOrgs } = useQuery({
    ...managerOrganizationQueries.managerOrganizationsList(),
    enabled: managerDashboardFlag === true,
  })
  const isManager =
    managerOrgs?.some(matchOrganizationBySlug(org.slug.replace(/^org-/, ""))) ??
    false

  const skeleton = (
    <Stack gap="16px">
      {Array.from({ length: 2 }).map((_, index) => (
        <ProgramRoot key={index}>
          <ProgramHeader>
            <ProgramHeaderText>
              <Skeleton width="260px" height="28px" />
              <Skeleton width="420px" height="20px" />
            </ProgramHeaderText>
          </ProgramHeader>
          <PlainList>
            <Skeleton width="100%" height="65px" />
            <Skeleton width="100%" height="65px" />
            <Skeleton width="100%" height="65px" />
          </PlainList>
        </ProgramRoot>
      ))}
    </Stack>
  )

  if (isLoading) {
    return (
      <>
        <Stack>
          <ContractHeaderSection>
            <ContractHeader org={org} contract={contract} />
          </ContractHeaderSection>
          <WelcomeMessage key="welcome" contract={contract} />
        </Stack>
        {skeleton}
      </>
    )
  }

  return (
    <>
      <Stack>
        <ContractHeaderSection>
          <ContractHeader org={org} contract={contract} />
          {managerDashboardFlag && isManager && (
            <ManageButtonWrapper>
              <ButtonLink
                size="small"
                href={contractAdminView(
                  org.slug.replace(/^org-/, ""),
                  contract.slug,
                )}
              >
                Manage
              </ButtonLink>
            </ManageButtonWrapper>
          )}
        </ContractHeaderSection>
        {variantOptions.length > 1 && (
          <VariantPicker
            variantOptions={variantOptions}
            selectedVariant={selectedVariant}
            setSelectedVariant={setSelectedVariant}
            description={`${org.name} provides multiple ways to learn this material. Choose the version that best fits your goals.`}
          />
        )}
        <WelcomeMessage key="welcome" contract={contract} />
      </Stack>
      <ContractRoot>
        {programs.map(({ program, entries, programEnrollment }) => (
          <OrgProgramDisplay
            key={getKey({
              resourceType: ResourceType.Program,
              id: program.id,
            })}
            program={program}
            entries={entries}
            programEnrollment={programEnrollment}
          />
        ))}
        <ProgramCollectionsList>
          {collections.map(({ collection, entries }) => (
            <OrgProgramCollectionDisplay
              key={getKey({
                resourceType: ResourceType.ProgramCollection,
                id: collection.id,
              })}
              collection={collection}
              entries={entries}
            />
          ))}
        </ProgramCollectionsList>
        {showNoPrograms && (
          <HeaderRoot>
            <Typography variant="h3" component="h2">
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
