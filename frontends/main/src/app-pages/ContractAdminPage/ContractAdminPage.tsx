"use client"

import React, { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useQuery } from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  alpha,
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
  Alert,
  Button,
  TabButton,
  TabButtonList,
  VisuallyHidden,
} from "@mitodl/smoot-design"
import { AssignSeatsSection } from "./AssignSeatsSection"
import { RowActionMenu } from "./RowActionMenu"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { b2bApi } from "api/mitxonline-clients"
import type { AxiosError } from "axios"
import { matchOrganizationBySlug } from "@/common/utils"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import graduateLogo from "@/public/images/dashboard/graduate.png"

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
  borderRadius: "8px",
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const TableHeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  alignItems: "center",
  paddingBottom: "16px",
  borderBottom: `1px solid ${theme.custom.colors.silverGrayDark}`,
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

const TableCell = styled("div", {
  shouldForwardProp: (prop) => prop !== "$flex" && prop !== "$primary",
})<{ $flex: number; $primary?: boolean }>(({ $flex, $primary, theme }) => ({
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
}))

const StatusBadge = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "$status",
})<{ $status: "assigned" | "redeemed" }>(({ $status, theme }) => ({
  height: "20px",
  borderRadius: "4px",
  paddingRight: "8px",
  paddingLeft: "8px",
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold as number,
  // alpha() matches Figma spec which uses opacity on base colors
  ...($status === "redeemed" && {
    backgroundColor: alpha(theme.custom.colors.green, 0.2),
    color: theme.custom.colors.darkGreen,
  }),
  ...($status === "assigned" && {
    backgroundColor: alpha(theme.custom.colors.blue, 0.2),
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

function buildCsvRow(values: (string | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v ?? ""
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s
    })
    .join(",")
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [searchAnnouncement, setSearchAnnouncement] = useState("")
  const [rowActionResult, setRowActionResult] = useState<{
    message: string
    severity: "success" | "error"
  } | null>(null)
  const [rowActionAnnouncement, setRowActionAnnouncement] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  // Debounce search query to avoid firing a new request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [searchQuery])

  // Mirror row-action Alert text into an assertive live region — smoot-design
  // Alert announces only its aria-describedby ("success/error message") via NVDA
  // instead of the actual children text. Must be before early returns (Rules of Hooks).
  // Reset-then-set with a 100ms delay so the live region fires after the Alert's
  // role="alert" has been processed by NVDA, preventing the update from being dropped.
  useEffect(() => {
    if (!rowActionResult?.message) {
      setRowActionAnnouncement("")
      return
    }
    const prefix = rowActionResult.severity === "error" ? "error: " : ""
    const text = prefix + rowActionResult.message
    setRowActionAnnouncement("")
    const id = setTimeout(() => setRowActionAnnouncement(text), 100)
    return () => clearTimeout(id)
  }, [rowActionResult])

  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    isError: isOrgsError,
    error: orgsError,
  } = useQuery(managerOrganizationQueries.managerOrganizationsList())

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const contract = org?.contracts.find((c) => c.slug === contractSlug)

  const { data: contractDetail, isLoading: isLoadingContractDetail } = useQuery(
    {
      ...managerOrganizationQueries.managerContractDetail({
        id: contract?.id ?? 0,
        parent_lookup_organization: org?.id ?? 0,
      }),
      enabled: !!org && !!contract,
    },
  )

  const {
    data: codes,
    isLoading: isLoadingCodes,
    isError: isCodesError,
    error: codesError,
  } = useQuery({
    ...managerOrganizationQueries.managerContractCodes({
      id: contract?.id ?? 0,
      parent_lookup_organization: org?.id ?? 0,
      page,
      search_term: debouncedSearchQuery || undefined,
      status:
        statusFilter === "redeemed"
          ? "redeemed"
          : statusFilter === "pending"
            ? "assigned"
            : undefined,
    }),
    enabled: !!org && !!contract,
  })

  // Announce the result count after the query settles following a search change.
  // Using a ref to track the last announced query so we only fire once per change,
  // not on every re-render while loading.
  const announcedQueryRef = useRef("")
  useEffect(() => {
    if (isLoadingCodes || announcedQueryRef.current === debouncedSearchQuery)
      return
    announcedQueryRef.current = debouncedSearchQuery
    const count = codes?.count ?? 0
    setSearchAnnouncement("")
    const id = setTimeout(
      () => setSearchAnnouncement(`${count} result${count !== 1 ? "s" : ""}`),
      0,
    )
    return () => clearTimeout(id)
  }, [isLoadingCodes, debouncedSearchQuery, codes?.count])

  if (isLoadingOrgs) {
    return (
      <Page>
        <Skeleton width="100%" height="128px" />
      </Page>
    )
  }

  if (isOrgsError) {
    const status = (orgsError as AxiosError)?.response?.status
    if (status === 403 || status === 401) {
      return <ErrorContent title="Access denied" timSays="403" />
    }
    return <ErrorContent title="Something went wrong" timSays="Oops!" />
  }

  if (isCodesError) {
    const status = (codesError as AxiosError)?.response?.status
    if (status === 403 || status === 401 || status === 404) {
      return <ErrorContent title="Access denied" timSays="403" />
    }
    return <ErrorContent title="Something went wrong" timSays="Oops!" />
  }

  if (!org) {
    return <ErrorContent title="Access denied" timSays="403" />
  }

  if (!contract) {
    return <ErrorContent title="Contract not found" timSays="404" />
  }

  const totalPurchased = contractDetail?.total_codes
  const unassignedCount = contractDetail?.unassigned_codes
  const assignedCount = contractDetail?.assigned_codes
  const redeemedCount = contractDetail?.redeemed_codes

  const pageResults = codes?.results ?? []

  const totalCount = codes?.count ?? 0
  // Derive total pages from the response: if there's a next page we're on a
  // full page so results.length equals the backend page size; otherwise this
  // is the last page so totalPages equals the current page number.
  const totalPages =
    codes?.next && pageResults.length > 0
      ? Math.ceil(totalCount / pageResults.length)
      : page

  const handleTabChange = (_: React.SyntheticEvent, val: StatusFilter) => {
    setStatusFilter(val)
    setPage(1)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleExportCsv = async () => {
    if (!totalPurchased) return
    setIsExporting(true)
    try {
      const PAGE_SIZE = 500
      let page = 1
      let res = await b2bApi.b2bManagerOrganizationsContractsCodesList({
        id: contract.id,
        parent_lookup_organization: org.id,
        page,
        page_size: PAGE_SIZE,
      })
      const rows = [...res.data.results]
      while (res.data.next) {
        page += 1
        res = await b2bApi.b2bManagerOrganizationsContractsCodesList({
          id: contract.id,
          parent_lookup_organization: org.id,
          page,
          page_size: PAGE_SIZE,
        })
        rows.push(...res.data.results)
      }
      const header = buildCsvRow([
        "Assigned to",
        "Redeemed by",
        "Status",
        "Assigned on",
        "Redeemed on",
        "Last sent",
      ])
      const dataRows = rows.map((c) =>
        buildCsvRow([
          c.assigned_to,
          c.redeemed_by,
          c.redemption_status === "redeemed" ? "Redeemed" : "Pending claim",
          formatDate(c.assigned_on),
          formatDate(c.redeemed_on),
          formatDate(c.last_sent),
        ]),
      )
      const csv = [header, ...dataRows].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "seat-assignments.csv"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setRowActionResult({
        message: "CSV download started.",
        severity: "success",
      })
    } catch {
      setRowActionResult({
        message: "Could not export CSV. Please try again.",
        severity: "error",
      })
    } finally {
      setIsExporting(false)
    }
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
                {!isLoadingContractDetail && totalPurchased !== undefined ? (
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
              {isLoadingContractDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{totalPurchased}</StatValue>
              )}
              <StatLabel>Total purchased</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Unassigned">
              {isLoadingContractDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{unassignedCount}</StatValue>
              )}
              <StatLabel>Unassigned</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Pending claim">
              {isLoadingContractDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{assignedCount}</StatValue>
              )}
              <StatLabel>Pending claim</StatLabel>
            </StatBlock>
            <StatBlock role="group" aria-label="Redeemed">
              {isLoadingContractDetail ? (
                <Skeleton width="48px" height="36px" />
              ) : (
                <StatValue>{redeemedCount}</StatValue>
              )}
              <StatLabel>Redeemed</StatLabel>
            </StatBlock>
          </StatsSide>
        </HeaderSection>

        <AssignSeatsSection
          orgId={org.id}
          contractId={contract.id}
          availableSeats={unassignedCount ?? 0}
          isLoadingSeats={isLoadingContractDetail}
        />

        {/* Seat Assignments */}
        <SeatAssignmentsSection>
          <SectionTitle component="h2">Seat Assignments</SectionTitle>
          {/* Assertive live region — workaround for smoot-design Alert reading
              only aria-describedby ("success/error message") instead of children */}
          <VisuallyHidden aria-live="assertive" aria-atomic="true">
            {rowActionAnnouncement}
          </VisuallyHidden>
          {rowActionResult && (
            <Alert
              severity={rowActionResult.severity}
              closable
              onClose={() => setRowActionResult(null)}
            >
              {rowActionResult.message}
            </Alert>
          )}
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
                placeholder="Search by name or email..."
                value={searchQuery}
                size="medium"
                onChange={handleSearchChange}
                onClear={() => {
                  setSearchQuery("")
                  setPage(1)
                }}
                onSubmit={() => {}}
              />
            </ControlsLeft>
            <ExportButtonWrapper>
              <Button
                variant="bordered"
                onClick={handleExportCsv}
                disabled={
                  isLoadingContractDetail || !totalPurchased || isExporting
                }
                aria-busy={isExporting}
              >
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            </ExportButtonWrapper>
          </SeatAssignmentsControls>
          <VisuallyHidden aria-live="polite" aria-atomic="true">
            {searchAnnouncement}
          </VisuallyHidden>
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
                    : pageResults.length === 0
                      ? "No seat assignments found"
                      : `Showing page ${page} of ${totalPages}`}
                </VisuallyHidden>
                {isLoadingCodes ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <TableRow role="row" key={i}>
                        <div role="cell" style={{ flex: 1 }}>
                          <Skeleton width="100%" height="48px" />
                        </div>
                      </TableRow>
                    ))}
                  </>
                ) : pageResults.length === 0 ? (
                  <TableRow role="row">
                    <EmptyTableMessage
                      role="cell"
                      aria-colspan={7}
                      style={{ flex: 1 }}
                    >
                      No seat assignments found.
                    </EmptyTableMessage>
                  </TableRow>
                ) : (
                  pageResults.map((code) => (
                    <TableRow role="row" key={code.id}>
                      <TableCell
                        role="cell"
                        $flex={COLUMN_FLEX.assignedTo}
                        $primary
                      >
                        {code.assigned_to ?? STUB}
                      </TableCell>
                      <TableCell role="cell" $flex={COLUMN_FLEX.redeemedBy}>
                        <MobileLabel>Redeemed by</MobileLabel>
                        {code.redeemed_by ?? STUB}
                      </TableCell>
                      <TableCell role="cell" $flex={COLUMN_FLEX.status}>
                        <MobileLabel>Status</MobileLabel>
                        <StatusBadge
                          $status={
                            code.redemption_status === "assigned"
                              ? "assigned"
                              : "redeemed"
                          }
                          label={
                            code.redemption_status === "redeemed"
                              ? "Redeemed"
                              : "Pending claim"
                          }
                        />
                      </TableCell>
                      <TableCell role="cell" $flex={COLUMN_FLEX.assignedOn}>
                        <MobileLabel>Assigned on</MobileLabel>
                        {formatDate(code.assigned_on)}
                      </TableCell>
                      <TableCell role="cell" $flex={COLUMN_FLEX.redeemedOn}>
                        <MobileLabel>Redeemed on</MobileLabel>
                        {formatDate(code.redeemed_on)}
                      </TableCell>
                      <TableCell role="cell" $flex={COLUMN_FLEX.lastSent}>
                        <MobileLabel>Last sent</MobileLabel>
                        {formatDate(code.last_sent)}
                      </TableCell>
                      <ActionCell role="cell">
                        <RowActionMenu
                          code={code}
                          orgId={org.id}
                          contractId={contract.id}
                          onResult={(message, severity) =>
                            setRowActionResult({ message, severity })
                          }
                        />
                      </ActionCell>
                    </TableRow>
                  ))
                )}
              </div>
            </div>
            <TableFooter>
              <TableFootnote aria-hidden="true">
                {totalCount === 0
                  ? "No assignments"
                  : `Page ${page} of ${totalPages}`}
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
