"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { RiMoreLine } from "@remixicon/react"
import {
  Chip,
  Container,
  Pagination,
  SearchInput,
  Skeleton,
  Stack,
  TabContext,
  Typography,
  styled,
} from "ol-components"
import {
  Button,
  TabButton,
  TabButtonList,
  VisuallyHidden,
} from "@mitodl/smoot-design"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import type { ContractCode } from "api/mitxonline-hooks/organizations"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import graduateLogo from "@/public/images/dashboard/graduate.png"

const PAGE_SIZE = 20

const Page = styled(Container)(({ theme }) => ({
  maxWidth: "1400px",
  padding: "40px 24px",
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
  },
}))

const HeaderSection = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
}))

const OrgDetailsContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "24px",
})

const ImageContainer = styled.div(({ theme }) => ({
  display: "flex",
  width: "60px",
  height: "60px",
  padding: "8px",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  overflow: "hidden",
  "> img": {
    width: "100%",
    height: "auto",
  },
}))

const OrgName = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const ContractSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const StatsSide = styled.div(({ theme }) => ({
  display: "flex",
  gap: "64px",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    gap: "32px",
    flexWrap: "wrap",
  },
}))

const StatBlock = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
})

const StatValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const StatLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const SeatAssignmentsSection = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  paddingTop: "8px",
})

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
})) as typeof Typography

const StyledSearchInput = styled(SearchInput)(({ theme }) => ({
  minWidth: "356px",
  [theme.breakpoints.down("md")]: {
    minWidth: "auto",
    width: "100%",
    order: -1,
  },
}))

const SeatAssignmentsControls = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}))

const ExportButtonWrapper = styled.div(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    width: "100%",
    "> button": {
      width: "100%",
    },
  },
}))

const ControlsLeft = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  flex: 1,
  [theme.breakpoints.down("md")]: {
    flexWrap: "wrap",
    gap: "12px",
  },
}))

const TableCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  padding: "32px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const TableHeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  paddingBottom: "16px",
  borderBottom: `2px solid ${theme.custom.colors.silverGrayDark}`,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const TableHeaderCell = styled("div", {
  shouldForwardProp: (prop) => prop !== "$flex",
})<{ $flex: number }>(({ $flex, theme }) => ({
  flex: $flex,
  minWidth: 0,
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
}))

const TableRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: `1px solid ${theme.custom.colors.silverGrayLight}`,
  "&:last-child": {
    borderBottom: "none",
  },
  [theme.breakpoints.down("md")]: {
    position: "relative",
    flexWrap: "wrap",
    gap: "6px 0",
    padding: "16px 40px 16px 0",
  },
}))

const MobileLabel = styled.span(({ theme }) => ({
  display: "none",
  [theme.breakpoints.down("md")]: {
    display: "inline",
    ...theme.typography.subtitle2,
    color: theme.custom.colors.darkGray2,
    minWidth: "120px",
    flexShrink: 0,
  },
}))

const TableCell = styled.div<{ $flex: number; $primary?: boolean }>(
  ({ $flex, $primary, theme }) => ({
    flex: $flex,
    minWidth: 0,
    ...theme.typography.body2,
    color: theme.custom.colors.black,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("md")]: {
      flex: "none",
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      overflow: "visible",
      whiteSpace: "normal",
      ...($primary && {
        ...theme.typography.subtitle2,
        marginBottom: "4px",
      }),
    },
  }),
)

const StatusBadge = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "$status",
})<{ $status: "redeemed" | "pending" }>(({ $status, theme }) => ({
  height: "20px",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: theme.typography.fontWeightBold as number,
  lineHeight: "16px",
  "& .MuiChip-label": {
    padding: "0 8px",
  },
  ...($status === "redeemed" && {
    backgroundColor: `${theme.custom.colors.green}33`,
    color: theme.custom.colors.darkGreen,
  }),
  ...($status === "pending" && {
    backgroundColor: `${theme.custom.colors.blue}33`,
    color: theme.custom.colors.darkBlue,
  }),
}))

const ActionCell = styled.div(({ theme }) => ({
  width: "40px",
  flexShrink: 0,
  display: "flex",
  justifyContent: "center",
  [theme.breakpoints.down("md")]: {
    position: "absolute",
    top: "16px",
    right: 0,
  },
}))

const IconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  padding: "4px",
  cursor: "pointer",
  borderRadius: "4px",
  color: theme.custom.colors.silverGrayDark,
  display: "flex",
  alignItems: "center",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray2,
    color: theme.custom.colors.darkGray2,
  },
  "&:focus-visible": {
    outline: `2px solid ${theme.custom.colors.darkGray2}`,
    outlineOffset: "2px",
  },
}))

const TableFooter = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: "16px",
})

const TableFootnote = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const EmptyTableMessage = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  padding: "32px 0",
  textAlign: "center",
})) as typeof Typography

const STUB = "—"

type StatusFilter = "all" | "pending" | "redeemed"

const COLUMN_FLEX = {
  assignedTo: 2,
  redeemedBy: 2,
  status: 1.5,
  assignedOn: 1.2,
  redeemedOn: 1.2,
  lastSent: 1,
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return STUB
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function isRedeemed(code: ContractCode): boolean {
  return code.is_redeemed
}

type ContractAdminPageInternalProps = {
  orgSlug: string
  contractSlug: string
}

const ContractAdminPageInternal: React.FC<ContractAdminPageInternalProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    isError: isOrgsError,
  } = useQuery(managerOrganizationQueries.managerOrganizationsList())

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const contract = org?.contracts.find((c) => c.slug === contractSlug)

  const { data: contractDetail, isLoading: isLoadingDetail } = useQuery({
    ...managerOrganizationQueries.managerContractDetail({
      id: contract?.id ?? 0,
      parent_lookup_organization: org?.id ?? 0,
    }),
    enabled: !!org && !!contract,
  })

  const { data: codes, isLoading: isLoadingCodes } = useQuery({
    ...managerOrganizationQueries.managerContractCodes({
      id: contract?.id ?? 0,
      parent_lookup_organization: org?.id ?? 0,
    }),
    enabled: !!org && !!contract,
  })

  if (isLoadingOrgs) {
    return (
      <Page>
        <Skeleton width="100%" height="128px" />
      </Page>
    )
  }

  if (isOrgsError) {
    return <ErrorContent title="Something went wrong" timSays="Oops!" />
  }

  if (!org) {
    return <ErrorContent title="Organization not found" timSays="404" />
  }

  if (!contract) {
    return <ErrorContent title="Contract not found" timSays="404" />
  }

  const totalPurchased = contractDetail?.total_codes
  const totalRedeemed = contractDetail?.total_enrollments

  const filteredCodes = (codes ?? []).filter((code) => {
    const redeemed = isRedeemed(code)
    const matchesFilter =
      statusFilter === "all" ||
      (statusFilter === "redeemed" && redeemed) ||
      (statusFilter === "pending" && !redeemed)
    const email = code.redeemed_by ?? ""
    const matchesSearch =
      !searchQuery || email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalPages = Math.ceil(filteredCodes.length / PAGE_SIZE)
  const pagedCodes = filteredCodes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )

  const handleTabChange = (_: React.SyntheticEvent, val: StatusFilter) => {
    setStatusFilter(val)
    setPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  return (
    <Page>
      <Stack gap="24px">
        {/* Header */}
        <HeaderSection>
          <OrgDetailsContainer>
            <ImageContainer>
              <Image
                width={60}
                height={60}
                src={org.logo ?? graduateLogo}
                alt=""
              />
            </ImageContainer>
            <div>
              <OrgName component="h1">{org.name}</OrgName>
              <ContractSubtitle>
                <span>{contract.name}</span>
                {isLoadingDetail ? null : totalPurchased !== undefined ? (
                  <>
                    {" "}
                    · <span>{totalPurchased} seats</span>
                  </>
                ) : null}
              </ContractSubtitle>
            </div>
          </OrgDetailsContainer>
          <StatsSide>
            <StatBlock role="group" aria-label="Total purchased">
              {isLoadingDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{totalPurchased ?? STUB}</StatValue>
              )}
              <StatLabel>Total purchased</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Unassigned">
              <StatValue>{STUB}</StatValue>
              <StatLabel>Unassigned</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Pending claim">
              <StatValue>{STUB}</StatValue>
              <StatLabel>Pending claim</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Redeemed">
              {isLoadingDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{totalRedeemed ?? STUB}</StatValue>
              )}
              <StatLabel>Redeemed</StatLabel>
            </StatBlock>
          </StatsSide>
        </HeaderSection>

        {/* Seat Assignments */}
        <SeatAssignmentsSection>
          <SectionTitle component="h2">Seat Assignments</SectionTitle>
          <SeatAssignmentsControls>
            <ControlsLeft>
              <TabContext value={statusFilter}>
                <TabButtonList onChange={handleTabChange}>
                  <TabButton label="All" value="all" />
                  <TabButton label="Pending claim" value="pending" />
                  <TabButton label="Redeemed" value="redeemed" />
                </TabButtonList>
              </TabContext>
              <StyledSearchInput
                placeholder="Search by email..."
                value={searchQuery}
                size="medium"
                onChange={handleSearchChange}
                onClear={() => {
                  setSearchQuery("")
                  setPage(1)
                }}
                onSubmit={(e) => setSearchQuery(e.target.value)}
              />
            </ControlsLeft>
            <ExportButtonWrapper>
              <Button variant="bordered">Export CSV</Button>
            </ExportButtonWrapper>
          </SeatAssignmentsControls>
          <TableCard>
            <div role="table" aria-label="Seat assignments">
              <div role="rowgroup">
                <TableHeaderRow role="row">
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.assignedTo}
                  >
                    Assigned to
                  </TableHeaderCell>
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.redeemedBy}
                  >
                    Redeemed by
                  </TableHeaderCell>
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.status}
                  >
                    Status
                  </TableHeaderCell>
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.assignedOn}
                  >
                    Assigned on
                  </TableHeaderCell>
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.redeemedOn}
                  >
                    Redeemed on
                  </TableHeaderCell>
                  <TableHeaderCell
                    role="columnheader"
                    $flex={COLUMN_FLEX.lastSent}
                  >
                    Last sent
                  </TableHeaderCell>
                  <ActionCell role="columnheader" />
                </TableHeaderRow>
              </div>
              <div role="rowgroup">
                <VisuallyHidden aria-live="polite" aria-atomic="true">
                  {isLoadingCodes
                    ? "Loading seat assignments"
                    : filteredCodes.length === 0
                      ? "No seat assignments found"
                      : `Showing ${filteredCodes.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredCodes.length)} of ${filteredCodes.length} assignment${filteredCodes.length !== 1 ? "s" : ""}`}
                </VisuallyHidden>
                {isLoadingCodes ? (
                  <Stack gap="8px" paddingTop="16px">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} width="100%" height="48px" />
                    ))}
                  </Stack>
                ) : pagedCodes.length === 0 ? (
                  <EmptyTableMessage role="cell">
                    No seat assignments found.
                  </EmptyTableMessage>
                ) : (
                  pagedCodes.map((code) => {
                    const redeemed = isRedeemed(code)
                    return (
                      <TableRow role="row" key={code.id}>
                        <TableCell
                          role="cell"
                          $flex={COLUMN_FLEX.assignedTo}
                          $primary
                        >
                          {STUB}
                        </TableCell>
                        <TableCell role="cell" $flex={COLUMN_FLEX.redeemedBy}>
                          <MobileLabel>Redeemed by</MobileLabel>
                          {code.redeemed_by ?? STUB}
                        </TableCell>
                        <TableCell role="cell" $flex={COLUMN_FLEX.status}>
                          <MobileLabel>Status</MobileLabel>
                          <StatusBadge
                            $status={redeemed ? "redeemed" : "pending"}
                            label={redeemed ? "Redeemed" : "Pending claim"}
                          />
                        </TableCell>
                        <TableCell role="cell" $flex={COLUMN_FLEX.assignedOn}>
                          <MobileLabel>Assigned on</MobileLabel>
                          {STUB}
                        </TableCell>
                        <TableCell role="cell" $flex={COLUMN_FLEX.redeemedOn}>
                          <MobileLabel>Redeemed on</MobileLabel>
                          {formatDate(code.redeemed_on)}
                        </TableCell>
                        <TableCell role="cell" $flex={COLUMN_FLEX.lastSent}>
                          <MobileLabel>Last sent</MobileLabel>
                          {STUB}
                        </TableCell>
                        <ActionCell role="cell">
                          <IconButton
                            type="button"
                            aria-label={`More actions for ${code.redeemed_by ?? "unassigned seat"}`}
                          >
                            <RiMoreLine size={16} />
                          </IconButton>
                        </ActionCell>
                      </TableRow>
                    )
                  })
                )}
              </div>
            </div>
            <TableFooter>
              <TableFootnote aria-hidden="true">
                Showing{" "}
                {filteredCodes.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredCodes.length)} of{" "}
                {filteredCodes.length} assignment
                {filteredCodes.length !== 1 ? "s" : ""}
              </TableFootnote>
              {totalPages > 1 && (
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, p) => setPage(p)}
                  shape="rounded"
                  size="small"
                  aria-label="Seat assignments pagination"
                />
              )}
            </TableFooter>
          </TableCard>
        </SeatAssignmentsSection>
      </Stack>
    </Page>
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
      <Page>
        <Skeleton width="100%" height="128px" />
      </Page>
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
