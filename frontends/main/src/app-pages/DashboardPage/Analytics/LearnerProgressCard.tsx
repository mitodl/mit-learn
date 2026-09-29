"use client"

import React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Link, Skeleton, styled, Typography, useTheme } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import type { CompletionStatusCounts } from "api/analytics-hooks/organizations"
import { EmptyTableMessage, TableCard } from "@/components/B2BTable/B2BTable"
import { progressStatusColors } from "./chartPalette"
import { formatCount, formatPercent } from "./format"
import SectionError from "./SectionError"

/**
 * KPI tiles and status-bucket distribution from the `learner-progress`
 * endpoint. Contract-scoped only — there's no org-wide equivalent, so
 * `AnalyticsContent` renders this section only when a contract is in view.
 *
 * `total_count` and `completion_status_counts` aren't k-anonymity-floored
 * like every other section on this page (waived for this endpoint — see
 * `analytics/types.ts`), so nothing here uses `SuppressibleValue`. The three
 * buckets falling short of `totalCount` isn't a bug: a consent-withheld
 * learner has no `completion_status` and lands in none of them.
 */

const BUCKETS = [
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const

type BucketKey = (typeof BUCKETS)[number]["key"]

/** Folds `passed`+`certified` into "Completed", matching the learner
 * directory's Status filter (`STATUS_FILTER_COMPLETION_STATUS` in
 * `ContractLearnersPage.tsx`). */
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
  opacity: 0,
  transition: "opacity 150ms ease",
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
}> = ({ label, value, learnersHref }) => (
  <TileBox role="group" aria-label={label}>
    <TileLabel>{label}</TileLabel>
    <TileValue>{formatCount(value)}</TileValue>
    <TileLink
      href={learnersHref}
      color="red"
      size="small"
      aria-label={`View all learners (${label} tile)`}
    >
      View all learners <RiArrowRightLine aria-hidden="true" />
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

const LearnerProgressCard: React.FC<{
  totalCount: number | undefined
  statusCounts: CompletionStatusCounts | undefined
  isLoading: boolean
  isError?: boolean
  learnersHref: string
}> = ({ totalCount, statusCounts, isLoading, isError, learnersHref }) => {
  // Above the early returns: hooks cannot be called conditionally.
  const statusColors = progressStatusColors(useTheme())

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

  return (
    <Root>
      <TileRow>
        <Tile label="Enrolled" value={totalCount} learnersHref={learnersHref} />
        <Tile
          label="Not started"
          value={buckets.not_started}
          learnersHref={learnersHref}
        />
        <Tile
          label="In progress"
          value={buckets.in_progress}
          learnersHref={learnersHref}
        />
        <Tile
          label="Completed"
          value={buckets.completed}
          learnersHref={learnersHref}
        />
        {/* Disabled: Needs attention tile — no needs_attention aggregate
            exists yet (not_started OR 30+ days inactive). See the witan
            project "Needs-attention aggregate for B2B learner progress".
            Restore once that aggregate ships:
          <Tile label="Needs attention" value={needsAttention} />
          */}
      </TileRow>

      <TableCard>
        <DistributionList
          role="list"
          aria-label="Learner progress distribution"
        >
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
                    {/* Restores the "Learners" column header's context, lost
                        when this became a list instead of a table. */}
                    <VisuallyHidden> learners,</VisuallyHidden>
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
    </Root>
  )
}

export default LearnerProgressCard
