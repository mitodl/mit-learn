"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import Image from "next/image"
import {
  Container,
  MuiCheckbox,
  SearchInput,
  SimpleSelectField,
  Skeleton,
  Stack,
  styled,
  Typography,
} from "ol-components"
import { Alert, Button, VisuallyHidden } from "@mitodl/smoot-design"
import {
  analyticsContractQueries,
  type LearnerStatusFilter,
  type LearnerWithEnrollments,
} from "api/analytics-hooks/organizations"
import { managerOrganizationQueries } from "api/mitxonline-hooks/organizations"
import { isAnalyticsConfigured } from "api/runtime"
import { AriaDisabledButtonWrapper } from "@/components/B2BTable/B2BTable"
import { matchOrganizationBySlug } from "@/common/utils"
import {
  ForbiddenError,
  isAnalyticsNotLoaded,
  isForbiddenResponse,
} from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import ContractManagerNav from "@/components/ContractManagerNav/ContractManagerNav"
import {
  FACET_MENU_PROPS,
  facetLabel,
  MenuBox,
  MenuRow,
} from "@/components/FacetMenu/FacetMenu"
import SectionHeader, {
  SectionFreshness,
} from "../DashboardPage/Analytics/SectionHeader"
import { ErrorContent } from "../ErrorPage/ErrorPageTemplate"
import {
  buildGridCsv,
  gridColumns,
  gridLearnersQuery,
  ProgressGrid,
} from "./ProgressGrid"
import {
  ALL_MODULES,
  type LearnersPageStatus,
  STATUS_FILTER_COMPLETION_STATUS,
} from "@/common/urls"
import {
  ALL,
  MAX_GRID_MODULES,
  SEARCH_MAX_LENGTH,
  useLearnerFilters,
} from "./useLearnerFilters"

/**
 * The B2B learner directory: one row per contract member, one column per
 * course the learner dashboard shows for the contract.
 *
 * Routed outside `/dashboard` (see `CONTRACT_LEARNERS_VIEW`) so it gets no
 * sidebar and can use the full width this table needs.
 */

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
    alignItems: "stretch",
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

const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const ExportWrapper = styled(AriaDisabledButtonWrapper)(({ theme }) => ({
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    "> button": { width: "100%" },
  },
}))

const ResultsSection = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const AsOfRow = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  [theme.breakpoints.down("md")]: {
    justifyContent: "flex-start",
  },
}))

const ControlsRow = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const ControlsRight = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
  },
}))

const StyledSearchInput = styled(SearchInput)(({ theme }) => ({
  minWidth: "280px",
  [theme.breakpoints.down("md")]: { minWidth: "auto", width: "100%" },
}))

const FilterField = styled(SimpleSelectField)(({ theme }) => ({
  "& .MuiSelect-root": {
    width: "280px",
  },
  "& .MuiInputBase-root.MuiInputBase-readOnly": {
    backgroundColor: theme.custom.colors.lightGray1,
    color: theme.custom.colors.silverGrayDark,
    "&:hover:not(.Mui-focused)": {
      borderColor: theme.custom.colors.silverGrayLight,
    },
    ".MuiSelect-select": { cursor: "default" },
  },
  [theme.breakpoints.down("md")]: {
    width: "100%",
    "& .MuiSelect-root": {
      width: "100%",
    },
  },
}))

const SelectedValue = styled.span({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
})

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: "All learners" },
  { value: "not_enrolled", label: "Not enrolled" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Completed" },
]
const STATUS_FILTER: Record<LearnersPageStatus, LearnerStatusFilter[]> = {
  ...STATUS_FILTER_COMPLETION_STATUS,
  not_enrolled: ["not_enrolled"],
}
const STATUS_HINT_ID = "learner-status-hint"
/** The keys MUI's select opens on. */
const OPEN_KEYS = [" ", "ArrowUp", "ArrowDown", "Enter"]
/** The value stands in for help text, which would sit below the field and shift the grid when it went away. */
const STATUS_UNAVAILABLE = {
  loading: {
    value: "Loading…",
    hint: "Status needs this contract's modules, which are loading.",
  },
  noModule: {
    value: "Select a module first",
    hint: "Select a module to filter by status.",
  },
  modulesFailed: {
    value: "Unavailable",
    hint: "Status needs this contract's modules, which couldn't load.",
  },
}

/**
 * Unavailable is `readOnly` plus `aria-disabled` rather than `disabled`, which
 * would drop the field from the tab order and leave a keyboard or screen
 * reader user no way to reach the reason. MUI skips `preventDefault` while
 * `readOnly`, so the keys that would open it are stopped here to keep them
 * from scrolling the page.
 */
const StatusSelect: React.FC<{
  value: string
  onChange: (value: string) => void
  unavailable?: keyof typeof STATUS_UNAVAILABLE
}> = ({ value, onChange, unavailable }) => (
  <>
    <FilterField
      label="Status"
      size="medium"
      value={value}
      options={STATUS_OPTIONS}
      readOnly={!!unavailable}
      SelectDisplayProps={
        unavailable
          ? {
              "aria-disabled": "true",
              "aria-busy": unavailable === "loading" ? "true" : undefined,
              "aria-describedby": STATUS_HINT_ID,
              onKeyDown: (event) => {
                if (OPEN_KEYS.includes(event.key)) event.preventDefault()
              },
            }
          : undefined
      }
      renderValue={(selected) => (
        <SelectedValue>
          {unavailable
            ? STATUS_UNAVAILABLE[unavailable].value
            : STATUS_OPTIONS.find((option) => option.value === selected)?.label}
        </SelectedValue>
      )}
      onChange={(event) => onChange(String(event.target.value))}
    />
    {unavailable ? (
      <VisuallyHidden id={STATUS_HINT_ID}>
        {STATUS_UNAVAILABLE[unavailable].hint}
      </VisuallyHidden>
    ) : null}
  </>
)

/**
 * The control is full-width on small screens and 280px on desktop, so the menu
 * takes the control's width as its minimum rather than the facet menu's fixed
 * 270px. Select sets that minimum inline from the control.
 */
const MODULES_MENU_PROPS = {
  ...FACET_MENU_PROPS,
  PaperProps: {
    sx: {
      ...FACET_MENU_PROPS.PaperProps.sx,
      width: "auto",
      maxWidth: "calc(100vw - 32px)",
    },
  },
}

/**
 * The count is said in the field's label, which is what names the combobox,
 * so the badge drawn inside it stays hidden.
 */
const ModulesSelect: React.FC<{
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  error: boolean
}> = ({ options, value, onChange, error }) => (
  <FilterField
    label={
      <>
        Modules
        {value.length > 0 ? (
          <VisuallyHidden>, {value.length} selected</VisuallyHidden>
        ) : null}
      </>
    }
    size="medium"
    multiple
    value={value}
    error={error}
    errorText="Couldn't load modules. Reload to try again."
    MenuProps={MODULES_MENU_PROPS}
    options={options.map((option) => ({
      value: option.value,
      label: (
        <MenuRow>
          <MenuBox checked={value.includes(option.value)} aria-hidden />
          {option.label}
        </MenuRow>
      ),
    }))}
    renderValue={(selected) => {
      const ids = selected as string[]
      if (ids.length === 0) return <SelectedValue>All modules</SelectedValue>
      if (ids.length === 1) {
        return (
          <SelectedValue>
            {options.find((option) => option.value === ids[0])?.label}
          </SelectedValue>
        )
      }
      return facetLabel("Selected", ids)
    }}
    onChange={(event) => {
      const next = event.target.value
      onChange(typeof next === "string" ? next.split(",") : (next as string[]))
    }}
  />
)

const CheckboxField = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minHeight: "40px",
  [theme.breakpoints.down("md")]: {
    minHeight: "auto",
  },
}))

const CheckboxLabel = styled("label", {
  shouldForwardProp: (prop) => prop !== "$unavailable",
})<{ $unavailable: boolean }>(({ $unavailable, theme }) => ({
  display: "flex",
  alignItems: "center",
  cursor: $unavailable ? "default" : "pointer",
  ...theme.typography.body2,
  color: $unavailable
    ? theme.custom.colors.silverGrayLight
    : theme.custom.colors.silverGrayDark,
  ".MuiCheckbox-root": {
    padding: "0 4px 0 0",
    color: "inherit",
  },
}))

const NEEDS_ATTENTION_LABEL = "Not started or inactive 30+ days"
const NEEDS_ATTENTION_HINT_ID = "learner-needs-attention-hint"

/**
 * Unavailable is `aria-disabled` rather than `disabled`, as in `StatusSelect`,
 * so a keyboard or screen reader user can still reach the reason. MUI's
 * checkbox stands in for smoot-design's, which can't carry `aria-disabled`.
 */
const NeedsAttentionCheckbox: React.FC<{
  checked: boolean
  onChange: (checked: boolean) => void
  unavailable: boolean
}> = ({ checked, onChange, unavailable }) => (
  <CheckboxField>
    <CheckboxLabel $unavailable={unavailable}>
      <MuiCheckbox
        size="small"
        disableRipple
        checked={checked}
        onChange={(event) => {
          if (!unavailable) onChange(event.target.checked)
        }}
        inputProps={
          unavailable
            ? {
                "aria-disabled": "true",
                "aria-describedby": NEEDS_ATTENTION_HINT_ID,
              }
            : undefined
        }
      />
      {NEEDS_ATTENTION_LABEL}
    </CheckboxLabel>
    {unavailable ? (
      <VisuallyHidden id={NEEDS_ATTENTION_HINT_ID}>
        Learners who haven&apos;t enrolled have no activity to flag.
      </VisuallyHidden>
    ) : null}
  </CheckboxField>
)

const ErrorRow = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "16px",
})

/** The `/learners` endpoint's maximum page size, in learners. */
const CSV_EXPORT_PAGE_SIZE = 100
/** Pages fetched at a time. The analytics API builds each page in memory and shares a small database pool, so this stays low. */
const CSV_EXPORT_CONCURRENCY = 2
const UNAVAILABLE_MESSAGE_ID = "learner-analytics-unavailable-message"
const NOT_LOADED_MESSAGE_ID = "learner-analytics-not-loaded-message"
const NO_LEARNERS_MESSAGE_ID = "learner-analytics-no-learners-message"
const MODULES_FAILED_MESSAGE_ID = "learner-export-modules-failed-message"

type ContractLearnersPageProps = {
  orgSlug: string
  contractSlug: string
}

const ContractLearnersPageInternal: React.FC<ContractLearnersPageProps> = ({
  orgSlug,
  contractSlug,
}) => {
  const {
    page,
    setPage,
    searchQuery,
    setSearchQuery,
    clearSearch,
    debouncedSearch,
    statusFilter,
    setStatusFilter,
    needsAttentionOnly,
    setNeedsAttentionOnly,
    gridModules,
    setGridModules,
    clearAll,
  } = useLearnerFilters()
  const [isExporting, setIsExporting] = useState(false)
  const [statusAnnouncement, setStatusAnnouncement] = useState("")
  const [actionResult, setActionResult] = useState<{
    message: string
    severity: "success" | "error"
  } | null>(null)
  const queryClient = useQueryClient()

  const controlsRef = useRef<HTMLDivElement>(null)
  const handleClearAll = () => {
    setStatusAnnouncement("")
    clearAll()
    controlsRef.current?.querySelector("input")?.focus()
  }

  const {
    data: managerOrgs,
    isLoading: isLoadingOrgs,
    error: orgsError,
  } = useQuery({
    ...managerOrganizationQueries.managerOrganizationsList(),
    throwOnError: false,
  })

  const org = managerOrgs?.find(matchOrganizationBySlug(orgSlug))
  const contract = org?.contracts.find((item) => item.slug === contractSlug)
  const orgUuid = org?.sso_organization_id ?? null
  const contractId = contract?.id ?? null
  const canQuery = isAnalyticsConfigured() && !!orgUuid && !!contractId

  const coursesQuery = useQuery({
    ...analyticsContractQueries.courses(orgUuid ?? "", contractId ?? 0, {
      limit: 1000,
    }),
    enabled: canQuery,
  })

  const courseOptions = useMemo(
    () =>
      (coursesQuery.data?.data ?? []).map((course) => ({
        value: course.course_readable_id,
        label: course.course_title,
      })),
    [coursesQuery.data],
  )
  /** Kept while loading or on error, so its error text can show. */
  const showModuleFilter = !coursesQuery.data || courseOptions.length > 1
  /**
   * Every module asks for the same learners as no module filter, so only a
   * partial selection is held to the API's cap; that keeps a dashboard link on
   * a contract with more modules than the API accepts from being cut short.
   */
  const activeGridModules = useMemo(() => {
    if (!showModuleFilter) return []
    const everyModule = gridModules.includes(ALL_MODULES)
    const selected = courseOptions
      .filter((option) => everyModule || gridModules.includes(option.value))
      .map((option) => option.value)
    return selected.length < courseOptions.length
      ? selected.slice(0, MAX_GRID_MODULES)
      : selected
  }, [showModuleFilter, gridModules, courseOptions])

  /** Status is per module, so it needs one selected, unless the contract has only one. */
  const statusAvailable = !showModuleFilter || activeGridModules.length > 0
  const activeStatus = statusAvailable ? statusFilter : ALL
  const completionStatus =
    activeStatus === ALL ? undefined : STATUS_FILTER[activeStatus]

  useEffect(() => {
    if (coursesQuery.isSuccess && !statusAvailable && statusFilter !== ALL) {
      setStatusFilter(ALL)
    }
  }, [coursesQuery.isSuccess, statusAvailable, statusFilter, setStatusFilter])

  /** The API never matches Not enrolled with needs attention: there's no enrollment to judge. */
  const needsAttentionAvailable = activeStatus !== "not_enrolled"
  const activeNeedsAttention = needsAttentionAvailable && needsAttentionOnly

  useEffect(() => {
    if (!needsAttentionAvailable && needsAttentionOnly) {
      setNeedsAttentionOnly(false)
    }
  }, [needsAttentionAvailable, needsAttentionOnly, setNeedsAttentionOnly])

  const handleStatusChange = (value: string) => {
    setStatusAnnouncement(
      value === "not_enrolled" && needsAttentionOnly
        ? `${NEEDS_ATTENTION_LABEL} filter cleared.`
        : "",
    )
    setStatusFilter(value)
  }

  /**
   * Every module is stored as `ALL_MODULES`, so the URL's 50-module cap can't
   * drop one. The announcement is emptied on every other change, so a later
   * reset is announced again.
   */
  const handleModulesChange = (values: string[]) => {
    setStatusAnnouncement(
      !values.length && activeStatus !== ALL ? "Status filter cleared." : "",
    )
    setGridModules(
      values.length > 0 && values.length === courseOptions.length
        ? [ALL_MODULES]
        : values,
    )
  }

  const coursesSettled = coursesQuery.isSuccess || coursesQuery.isError
  /** Whether modules and status in the URL apply depends on the contract's modules. */
  const filtersResolved =
    (gridModules.length === 0 && statusFilter === ALL) || coursesSettled

  /**
   * Modules narrow learners only through a status or needs attention: with
   * neither, every learner has a status in every module, Not enrolled
   * included, so the selection only picks the columns.
   */
  const requestModules = useMemo(
    () =>
      (completionStatus || activeNeedsAttention) &&
      activeGridModules.length < courseOptions.length
        ? activeGridModules
        : [],
    [completionStatus, activeNeedsAttention, activeGridModules, courseOptions],
  )

  const gridFilters = useMemo(
    () => ({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(completionStatus ? { completion_status: completionStatus } : {}),
      /** Only ever sent as `true`: no control here asks for the learners who are fine. */
      ...(activeNeedsAttention ? { needs_attention: true } : {}),
      ...(requestModules.length ? { course_readable_id: requestModules } : {}),
    }),
    [debouncedSearch, completionStatus, activeNeedsAttention, requestModules],
  )
  const gridQuery = useQuery({
    ...gridLearnersQuery(orgUuid ?? "", contractId ?? 0, gridFilters, page),
    enabled: canQuery && filtersResolved,
    placeholderData: keepPreviousData,
  })

  /** Read for the contract's learner count and freshness date. */
  const learnerTotalQuery = useQuery({
    ...analyticsContractQueries.learners(orgUuid ?? "", contractId ?? 0, {
      limit: 1,
      offset: 0,
    }),
    enabled: canQuery,
  })
  const totalLearners = learnerTotalQuery.data?.total_count ?? null
  const noLearners = totalLearners === 0

  /**
   * Only 400/401/403 responses throw to an error boundary (see
   * `makeBrowserQueryClient`); a 5xx or network failure just settles into
   * `isError` with `data` left undefined. The grid shows its own query's
   * failure; this covers the page's.
   */
  const hasLoadError = learnerTotalQuery.isError
  /**
   * The contract exists in MITx Online but the warehouse has not loaded it
   * yet. Not an error a retry can fix, so it gets its own message.
   */
  const notLoaded = [gridQuery, learnerTotalQuery, coursesQuery].some((query) =>
    isAnalyticsNotLoaded(query.error),
  )

  const courses = coursesQuery.data?.data
  const columns = useMemo(
    () => courses && gridColumns(courses, activeGridModules),
    [courses, activeGridModules],
  )
  const coursesFailed = coursesQuery.isError && !courses
  const exportUnavailable =
    !canQuery || notLoaded || noLearners || !filtersResolved || !columns

  const handleExport = useCallback(async () => {
    if (isExporting || exportUnavailable || !orgUuid || !contractId) return
    setIsExporting(true)
    try {
      const fetchPage = (pageNumber: number) =>
        queryClient.fetchQuery(
          gridLearnersQuery(
            orgUuid,
            contractId,
            gridFilters,
            pageNumber,
            CSV_EXPORT_PAGE_SIZE,
          ),
        )
      const first = await fetchPage(1)
      const learners: LearnerWithEnrollments[] = [...first.data]
      const pageCount = Math.ceil(first.total_count / CSV_EXPORT_PAGE_SIZE)
      for (let next = 2; next <= pageCount; next += CSV_EXPORT_CONCURRENCY) {
        const batch = await Promise.all(
          Array.from(
            { length: Math.min(CSV_EXPORT_CONCURRENCY, pageCount - next + 1) },
            (_, index) => fetchPage(next + index),
          ),
        )
        learners.push(...batch.flatMap((response) => response.data))
      }
      const csv = buildGridCsv(learners, columns)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `learners-${contractSlug}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setActionResult({
        message: "CSV download started.",
        severity: "success",
      })
    } catch {
      setActionResult({
        message: "Could not export learners. Please try again.",
        severity: "error",
      })
    } finally {
      setIsExporting(false)
    }
  }, [
    isExporting,
    exportUnavailable,
    orgUuid,
    contractId,
    contractSlug,
    queryClient,
    gridFilters,
    columns,
  ])

  if (isLoadingOrgs) {
    return (
      <Page>
        <Stack gap="24px">
          <Skeleton width="280px" height="48px" />
          <Skeleton width="100%" height="88px" />
          <Skeleton width="100%" height="400px" />
        </Stack>
      </Page>
    )
  }

  if (orgsError) {
    return (
      <Page>
        <ErrorContent
          title={
            isForbiddenResponse(orgsError)
              ? "Access denied"
              : "Something went wrong"
          }
          timSays={isForbiddenResponse(orgsError) ? "403" : "Oops!"}
        />
      </Page>
    )
  }

  if (!org) {
    return (
      <Page>
        <ErrorContent title="Access denied" timSays="403" />
      </Page>
    )
  }

  if (!contract) {
    return (
      <Page>
        <ErrorContent title="Contract not found" timSays="404" />
      </Page>
    )
  }

  const hasModuleFilter = activeGridModules.length > 0

  const hasActiveFilters =
    !!searchQuery ||
    activeStatus !== ALL ||
    hasModuleFilter ||
    activeNeedsAttention

  const emptyMessage = debouncedSearch
    ? "No learners match your search."
    : activeStatus !== ALL || hasModuleFilter || activeNeedsAttention
      ? "No learners match this filter."
      : "No learners found."

  return (
    <Page>
      <Stack gap="24px">
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
              <PageSubtitle component="p">
                Learners · {contract.name}
              </PageSubtitle>
            </div>
          </OrgDetailsContainer>
          <ExportWrapper>
            <Button
              variant="bordered"
              aria-disabled={isExporting || exportUnavailable}
              aria-describedby={
                !canQuery
                  ? UNAVAILABLE_MESSAGE_ID
                  : notLoaded
                    ? NOT_LOADED_MESSAGE_ID
                    : noLearners
                      ? NO_LEARNERS_MESSAGE_ID
                      : coursesFailed
                        ? MODULES_FAILED_MESSAGE_ID
                        : undefined
              }
              aria-busy={
                isExporting ||
                (canQuery &&
                  !notLoaded &&
                  (!filtersResolved || coursesQuery.isPending))
              }
              onClick={handleExport}
            >
              {isExporting ? "Exporting…" : "Export learners"}
            </Button>
            {coursesFailed ? (
              <VisuallyHidden id={MODULES_FAILED_MESSAGE_ID}>
                Export needs this contract&apos;s modules, which couldn&apos;t
                load.
              </VisuallyHidden>
            ) : null}
          </ExportWrapper>
        </HeaderSection>

        <ContractManagerNav
          orgSlug={orgSlug}
          contractSlug={contractSlug}
          current="learners"
        />

        {!canQuery ? (
          <Typography id={UNAVAILABLE_MESSAGE_ID} variant="body1">
            Learner analytics is not available in this environment.
          </Typography>
        ) : notLoaded ? (
          <Typography id={NOT_LOADED_MESSAGE_ID} variant="body1">
            Learner data for {contract.name} will be available once it has been
            loaded. Please check back later.
          </Typography>
        ) : hasLoadError ? (
          <Alert severity="error">
            <ErrorRow>
              <span>Something went wrong loading learner data.</span>
              <Button
                size="small"
                variant="bordered"
                onClick={() => learnerTotalQuery.refetch()}
              >
                Try again
              </Button>
            </ErrorRow>
          </Alert>
        ) : noLearners ? (
          <Typography id={NO_LEARNERS_MESSAGE_ID} variant="body1">
            No learners have joined {contract.name} yet. They&apos;ll appear
            here once they join.
          </Typography>
        ) : (
          <ResultsSection>
            <AsOfRow>
              <SectionFreshness
                asOf={learnerTotalQuery.data?.as_of}
                isLoading={learnerTotalQuery.isPending}
                isError={learnerTotalQuery.isError}
              />
            </AsOfRow>
            <ControlsRow>
              <SectionHeader
                component="h2"
                title="Learner results"
                description={
                  gridQuery.isError || learnerTotalQuery.isError
                    ? undefined
                    : gridQuery.data && totalLearners !== null
                      ? `${gridQuery.data.total_count} of ${totalLearners} learners`
                      : "Loading…"
                }
                asOfPlacement="external"
              />
              <ControlsRight ref={controlsRef}>
                <StyledSearchInput
                  placeholder="Search name or email"
                  value={searchQuery}
                  size="medium"
                  onChange={(event) =>
                    setSearchQuery(
                      event.target.value.slice(0, SEARCH_MAX_LENGTH),
                    )
                  }
                  onClear={clearSearch}
                  onSubmit={() => {}}
                />
                {showModuleFilter ? (
                  <ModulesSelect
                    options={courseOptions}
                    value={activeGridModules}
                    onChange={handleModulesChange}
                    error={coursesFailed}
                  />
                ) : null}
                <StatusSelect
                  value={activeStatus}
                  onChange={handleStatusChange}
                  unavailable={
                    statusAvailable
                      ? undefined
                      : coursesQuery.isPending
                        ? "loading"
                        : coursesFailed
                          ? "modulesFailed"
                          : "noModule"
                  }
                />
                <VisuallyHidden role="status" aria-atomic="true">
                  {statusAnnouncement}
                </VisuallyHidden>
                <NeedsAttentionCheckbox
                  checked={activeNeedsAttention}
                  onChange={(checked) => {
                    setStatusAnnouncement("")
                    setNeedsAttentionOnly(checked)
                  }}
                  unavailable={!needsAttentionAvailable}
                />
                <Button
                  variant="tertiary"
                  size="medium"
                  onClick={handleClearAll}
                  style={{
                    visibility: hasActiveFilters ? "visible" : "hidden",
                  }}
                >
                  Clear filters
                </Button>
              </ControlsRight>
            </ControlsRow>

            {actionResult ? (
              <Alert
                severity={actionResult.severity}
                closable
                onClose={() => setActionResult(null)}
              >
                {actionResult.message}
              </Alert>
            ) : null}

            <ProgressGrid
              filters={gridFilters}
              query={gridQuery}
              columns={columns}
              coursesFailed={coursesFailed}
              coursesFetching={coursesQuery.isFetching}
              onRetryCourses={() => coursesQuery.refetch()}
              page={page}
              onPageChange={setPage}
              emptyMessage={emptyMessage}
            />
          </ResultsSection>
        )}
      </Stack>
    </Page>
  )
}

const ContractLearnersPage: React.FC<ContractLearnersPageProps> = (props) => {
  const flagsLoaded = useFeatureFlagsLoaded()
  const enabled = useFeatureFlag(FeatureFlags.B2BLearnerAnalytics)

  if (!flagsLoaded) {
    return (
      <Page>
        <Stack gap="24px">
          <Skeleton width="280px" height="48px" />
          <Skeleton width="100%" height="400px" />
        </Stack>
      </Page>
    )
  }
  if (!enabled) throw new ForbiddenError("Not enabled.")

  return <ContractLearnersPageInternal {...props} />
}

export default ContractLearnersPage
export type { ContractLearnersPageProps }
