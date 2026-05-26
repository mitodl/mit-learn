"use client"

import React from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { Skeleton, Stack, Typography, styled } from "ol-components"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import graduateLogo from "@/public/images/dashboard/graduate.png"

const PageRoot = styled.div(({ theme }) => ({
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "40px 24px",
  [theme.breakpoints.down("sm")]: {
    padding: "24px 16px",
  },
}))

const HeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  padding: "24px",
  alignItems: "center",
  gap: "24px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 1px 3px 0 rgba(120, 147, 172, 0.40)",
  [theme.breakpoints.down("sm")]: {
    padding: "16px",
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
  flexShrink: 0,
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

const HeaderTextContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  flex: 1,
})

const OrgName = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
  },
})) as typeof Typography

const ContractName = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const SeatCount = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

type ContractAdminPageInternalProps = {
  orgSlug: string
  contractSlug: string
}

const ContractAdminPageInternal: React.FC<ContractAdminPageInternalProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const { data: managerOrgs, isLoading: isLoadingOrgs } = useQuery(
    managerOrganizationQueries.managerOrganizationsList(),
  )

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const contract = org?.contracts.find((c) => c.slug === contractSlug)

  const { data: contractDetail, isLoading: isLoadingDetail } = useQuery({
    ...managerOrganizationQueries.managerContractDetail({
      id: contract?.id ?? 0,
      parent_lookup_organization: org?.id ?? 0,
    }),
    enabled: !!org && !!contract,
  })

  if (isLoadingOrgs) {
    return (
      <PageRoot>
        <Skeleton width="100%" height="128px" />
      </PageRoot>
    )
  }

  if (!org) {
    return <ErrorContent title="Organization not found" timSays="404" />
  }

  if (!contract) {
    return <ErrorContent title="Contract not found" timSays="404" />
  }

  return (
    <PageRoot>
      <Stack gap="40px">
        <HeaderSection>
          <ImageContainer>
            <Image
              width={72}
              height={78}
              src={org.logo ?? graduateLogo}
              alt=""
            />
          </ImageContainer>
          <HeaderTextContainer>
            <OrgName component="h1">{org.name}</OrgName>
            <ContractName>{contract.name}</ContractName>
            {isLoadingDetail ? (
              <Skeleton width="80px" height="20px" />
            ) : (
              contractDetail?.total_codes !== undefined && (
                <SeatCount>{contractDetail.total_codes} seats</SeatCount>
              )
            )}
          </HeaderTextContainer>
        </HeaderSection>
      </Stack>
    </PageRoot>
  )
}

type ContractAdminPageProps = {
  orgSlug: string
  contractSlug: string
}

const ContractAdminPage: React.FC<ContractAdminPageProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const flagEnabled = useFeatureFlagEnabled(
    FeatureFlags.B2BContractManagerDashboard,
  )
  const flagsLoaded = useFeatureFlagsLoaded()

  if (!flagsLoaded) {
    return (
      <PageRoot>
        <Skeleton width="100%" height="128px" />
      </PageRoot>
    )
  }

  if (!flagEnabled) {
    throw new ForbiddenError("Not enabled.")
  }

  return (
    <ContractAdminPageInternal orgSlug={orgSlug} contractSlug={contractSlug} />
  )
}

export default ContractAdminPage

export type { ContractAdminPageProps }
