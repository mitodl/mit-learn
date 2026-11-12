"use client"

import React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Link, Skeleton, styled, Typography, useTheme } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type { CompletionStatusCounts } from "api/analytics-hooks/organizations"
import type { ContractLearnersStatus } from "@/common/urls"
import { EmptyTableMessage, TableCard } from "@/components/B2BTable/B2BTable"
import { progressStatusColors } from "./chartPalette"
import { formatCount, formatPercent } from "./format"
import SectionError from "./SectionError"

/**
 * KPI tiles and an enrollment distribution for one contract. Contract-scoped
 * only — there's no org-wide equivalent, so `AnalyticsContent` renders this
 * section only when a contract is in view.
 *
 * The tiles count learners, from the same `/learners` request each tile's link
 * opens, so a tile always matches the learner directory it leads to. A
 * learner with modules in several statuses counts under each, so the status
 * tiles can add up to more than "Learners enrolled".
 *
 * The distribution counts enrollments, from `learner-progress`, so its rows
 * sum to 100%. Neither endpoint is k-anonymity-floored like every other
 * section on this page (waived per mitodl/ol-analytics-api#58), so nothing
 * here uses `SuppressibleValue`. Both leave out learners who haven't
 * consented to share their progress.
 */

const BUCKETS = [
  { key: "not_started", label: "Not started", status: "not_started" },
  { key: "in_progress", label: "In progress", status: "in_progress" },
  { key: "completed", label: "Completed", status: "passed" },
] as const satisfies readonly {
  key: string
  label: string
  status: ContractLearnersStatus
}[]

type BucketKey = (typeof BUCKETS)[number]["key"]

/** Folds `passed`+`certified` into "Completed", matching the learner
 * directory's Status filter (`STATUS_FILTER_COMPLETION_STATUS` in
 * `common/urls.ts`). */
const bucketCounts = (
  counts: CompletionStatusCounts,
): Record<BucketKey, number> => ({
  not_started: counts.not_started,
  in_progress: counts.in_progress,
  completed: counts.passed + counts.certified,
})

const Root = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const DetailRow = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
  gap: "16px",
  alignItems: "stretch",
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
}))

const TileRow = styled.div(({ theme }) => ({
  display: "flex",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  overflow: "hidden",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}))

const TileBox = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "20px 24px",
  backgroundColor: theme.custom.colors.white,
  borderLeft: `1px solid ${theme.custom.colors.lightGray2}`,
  transition: "background-color 150ms ease",
  "&:first-of-type": {
    borderLeft: "none",
  },
  [theme.breakpoints.down("md")]: {
    borderLeft: "none",
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    "&:first-of-type": {
      borderTop: "none",
    },
  },
  "&:hover, &:focus-within": {
    backgroundColor: theme.custom.colors.lightGray1,
    "& a": {
      opacity: 1,
    },
  },
}))

const TileLink = styled(Link)({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  transition: "opacity 150ms ease",
  // Hidden until hover/focus only on pointers that can actually hover — on a
  // touch device this stays visible, since there is no hover state to reveal
  // it and no other way to discover the tile's only control.
  "@media (hover: hover)": {
    opacity: 0,
  },
  "& svg": {
    width: "14px",
    height: "14px",
  },
})

const TileLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const TileValue = styled(Typography)(({ theme }) => ({
  ...theme.typography.h3,
  color: theme.custom.colors.darkGray2,
  fontVariantNumeric: "tabular-nums",
})) as typeof Typography

const Tile: React.FC<{
  label: string
  value: number
  learnersHref: string
  linkText: string
  linkLabel: string
}> = ({ label, value, learnersHref, linkText, linkLabel }) => (
  <TileBox role="group" aria-label={label}>
    <TileLabel>{label}</TileLabel>
    <TileValue>{formatCount(value)}</TileValue>
    <TileLink
      href={learnersHref}
      color="red"
      size="small"
      aria-label={linkLabel}
    >
      {linkText} <RiArrowRightLine aria-hidden="true" />
    </TileLink>
  </TileBox>
)

/** One row per bucket, directly labeled — label/count/percent are all real
 * text, so unlike `EngagementTrendChart` there's no separate accessible
 * table to pair it with; only `TrackFill` is decorative. */
const DistributionList = styled.div({
  display: "flex",
  flexDirection: "column",
})

const DistributionRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "12px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray1}`,
  "&:last-child": {
    borderBottom: "none",
  },
}))

const RowLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  width: "112px",
  flexShrink: 0,
})) as typeof Typography

const Track = styled.div(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  height: "10px",
  borderRadius: "6px",
  overflow: "hidden",
  backgroundColor: theme.custom.colors.lightGray1,
}))

const TrackFill = styled("div", {
  shouldForwardProp: (prop) => prop !== "$color",
})<{ $color: string }>(({ $color }) => ({
  height: "100%",
  borderRadius: "inherit",
  backgroundColor: $color,
}))

const RowStats = styled.div({
  display: "flex",
  alignItems: "baseline",
  gap: "6px",
  width: "72px",
  flexShrink: 0,
  justifyContent: "flex-end",
})

const RowCount = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
  fontVariantNumeric: "tabular-nums",
})) as typeof Typography

const RowPercent = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  fontVariantNumeric: "tabular-nums",
})) as typeof Typography

const DistributionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const LearnerProgressCard: React.FC<{
  /** Learners on the contract (`all`), or with at least one enrollment in each status. */
  learnerCounts: Record<ContractLearnersStatus | "all", number>
  totalCount: number | undefined
  statusCounts: CompletionStatusCounts | undefined
  isLoading: boolean
  isError?: boolean
  learnersHref: (status?: ContractLearnersStatus) => string
  /** Rendered beside the distribution, stacking below it on narrow screens. */
  aside?: React.ReactNode
}> = ({
  learnerCounts,
  totalCount,
  statusCounts,
  isLoading,
  isError,
  learnersHref,
  aside,
}) => {
  const statusColors = progressStatusColors(useTheme())
  const distributionTitleId = React.useId()

  if (isError) {
    return (
      <TableCard>
        <SectionError />
      </TableCard>
    )
  }

  if (isLoading) {
    return (
      <Root>
        <TileRow>
          {Array.from({ length: 4 }).map((_, index) => (
            <TileBox key={index}>
              <Skeleton width="80px" height="20px" />
              <Skeleton width="48px" height="36px" />
            </TileBox>
          ))}
        </TileRow>
        <TableCard>
          <Skeleton variant="rectangular" width="100%" height="16px" />
        </TableCard>
      </Root>
    )
  }

  if (!totalCount || !statusCounts) {
    return (
      <TableCard>
        <EmptyTableMessage>No learner activity recorded yet.</EmptyTableMessage>
      </TableCard>
    )
  }

  const buckets = bucketCounts(statusCounts)
  const percentOf = (count: number) => (count / totalCount) * 100

  const distribution = (
    <TableCard>
      <DistributionTitle component="h3" id={distributionTitleId}>
        Enrollments by status
      </DistributionTitle>
      <DistributionList role="list" aria-labelledby={distributionTitleId}>
        {BUCKETS.map((bucket) => {
          const count = buckets[bucket.key]
          const percent = percentOf(count)
          return (
            <DistributionRow key={bucket.key} role="listitem">
              <RowLabel>{bucket.label}</RowLabel>
              <Track>
                {count > 0 ? (
                  <TrackFill
                    aria-hidden
                    $color={statusColors[bucket.key]}
                    style={{ width: `${percent}%` }}
                  />
                ) : null}
              </Track>
              <RowStats>
                <RowCount>
                  {formatCount(count)}
                  <VisuallyHidden> enrollments,</VisuallyHidden>
                </RowCount>
                <RowPercent>
                  {formatPercent(percent)}
                  <VisuallyHidden> of total</VisuallyHidden>
                </RowPercent>
              </RowStats>
            </DistributionRow>
          )
        })}
      </DistributionList>
    </TableCard>
  )

  return (
    <Root>
      <TileRow>
        <Tile
          label="Learners enrolled"
          value={learnerCounts.all}
          learnersHref={learnersHref()}
          linkText="View all learners"
          linkLabel="View all learners"
        />
        {BUCKETS.map((bucket) => (
          <Tile
            key={bucket.key}
            label={bucket.label}
            value={learnerCounts[bucket.status]}
            learnersHref={learnersHref(bucket.status)}
            linkText="View learners"
            linkLabel={`View learners (${bucket.label})`}
          />
        ))}
      </TileRow>

      {aside ? (
        <DetailRow>
          {distribution}
          {aside}
        </DetailRow>
      ) : (
        distribution
      )}
    </Root>
  )
}

export default LearnerProgressCard
