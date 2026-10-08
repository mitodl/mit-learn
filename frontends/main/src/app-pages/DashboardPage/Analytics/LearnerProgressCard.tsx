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
 * KPI tiles and status-bucket distribution from the `learner-progress`
 * endpoint. Contract-scoped only — there's no org-wide equivalent, so
 * `AnalyticsContent` renders this section only when a contract is in view.
 *
 * `total_count` and `completion_status_counts` aren't k-anonymity-floored
 * like every other section on this page (waived for this endpoint — see
 * `analytics/types.ts`), so nothing here uses `SuppressibleValue`.
 *
 * A consent-withheld learner has no `completion_status` and so lands in none
 * of the three buckets. The distribution therefore divides by `total_count`
 * minus `outcomes_withheld_count`: against `total_count` the rows would stop
 * summing to 100% the moment anyone withholds. The "Enrolled" tile still
 * shows the true `total_count` — a learner who withholds outcomes is still
 * enrolled, and netting them out there would disagree with the learner
 * directory and with every seat figure on this page — so a footnote names
 * the gap whenever there is one.
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

const DistributionNote = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  marginTop: "12px",
})) as typeof Typography

const LearnerProgressCard: React.FC<{
  totalCount: number | undefined
  withheldCount: number | undefined
  statusCounts: CompletionStatusCounts | undefined
  isLoading: boolean
  isError?: boolean
  learnersHref: (status?: ContractLearnersStatus) => string
  /** Rendered beside the distribution, stacking below it on narrow screens. */
  aside?: React.ReactNode
}> = ({
  totalCount,
  withheldCount,
  statusCounts,
  isLoading,
  isError,
  learnersHref,
  aside,
}) => {
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
  const withheld = Math.min(withheldCount ?? 0, totalCount)
  const reportedCount = totalCount - withheld
  const percentOf = (count: number) =>
    reportedCount > 0 ? (count / reportedCount) * 100 : 0
  const percentBasis = withheld > 0 ? " of learners who consented" : " of total"

  const distribution = (
    <TableCard>
      <DistributionList role="list" aria-label="Learner progress distribution">
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
                  <VisuallyHidden> learners,</VisuallyHidden>
                </RowCount>
                <RowPercent>
                  {formatPercent(percent)}
                  <VisuallyHidden>{percentBasis}</VisuallyHidden>
                </RowPercent>
              </RowStats>
            </DistributionRow>
          )
        })}
      </DistributionList>
      {withheld > 0 ? (
        <DistributionNote>
          Percentages exclude {formatCount(withheld)}{" "}
          {withheld === 1 ? "learner who has" : "learners who have"} not agreed
          to share their progress.
        </DistributionNote>
      ) : null}
    </TableCard>
  )

  return (
    <Root>
      <TileRow>
        <Tile
          label="Enrolled"
          value={totalCount}
          learnersHref={learnersHref()}
          linkText="View all learners"
          linkLabel="View all learners"
        />
        {BUCKETS.map((bucket) => (
          <Tile
            key={bucket.key}
            label={bucket.label}
            value={buckets[bucket.key]}
            learnersHref={learnersHref(bucket.status)}
            linkText="View learners"
            linkLabel={`View ${bucket.label.toLowerCase()} learners`}
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
