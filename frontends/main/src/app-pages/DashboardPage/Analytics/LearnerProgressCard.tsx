"use client"

import React from "react"
import { RiArrowRightLine } from "@remixicon/react"
import { Link, Skeleton, styled, Typography } from "ol-components"
import type { ContractLearnersStatus } from "@/common/urls"
import { EmptyTableMessage, TableCard } from "@/components/B2BTable/B2BTable"
import { formatCount } from "./format"
import SectionError from "./SectionError"

/**
 * Learner counts by status for one contract. Contract-scoped only — there's no
 * org-wide equivalent, so `AnalyticsContent` renders this section only when a
 * contract is in view.
 *
 * The tiles count learners, from the same `/learners` request each tile's link
 * opens, so a tile always matches the learner directory it leads to. A
 * learner with modules in several statuses counts under each, as the note
 * under the tiles says. `/learners` isn't k-anonymity-floored like every other
 * section on this page (waived per mitodl/ol-analytics-api#58), so nothing
 * here uses `SuppressibleValue`. It leaves out learners who haven't consented
 * to share their progress.
 */

/** "Completed" links to `passed`, which the learner directory's Status filter
 * folds together with `certified` (`STATUS_FILTER_COMPLETION_STATUS` in
 * `common/urls.ts`). */
const BUCKETS = [
  { label: "Not started", status: "not_started" },
  { label: "In progress", status: "in_progress" },
  { label: "Completed", status: "passed" },
] as const satisfies readonly {
  label: string
  status: ContractLearnersStatus
}[]

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

const ArrowLink = styled(Link)({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  "& svg": {
    width: "14px",
    height: "14px",
  },
})

const TileLink = styled(ArrowLink)({
  transition: "opacity 150ms ease",
  // Hidden until hover/focus only on pointers that can actually hover — on a
  // touch device this stays visible, since there is no hover state to reveal
  // it and no other way to discover the tile's only control.
  "@media (hover: hover)": {
    opacity: 0,
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

const NoteRow = styled.div({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px 16px",
})

const Note = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
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
      aria-label={`View learners (${label})`}
    >
      View learners <RiArrowRightLine aria-hidden="true" />
    </TileLink>
  </TileBox>
)

const LearnerProgressCard: React.FC<{
  /** Learners on the contract (`all`), or with at least one enrollment in each status. */
  learnerCounts: Record<ContractLearnersStatus | "all", number>
  isLoading: boolean
  isError?: boolean
  learnersHref: (status?: ContractLearnersStatus) => string
  /** Rendered full width below the tiles. */
  aside?: React.ReactNode
}> = ({ learnerCounts, isLoading, isError, learnersHref, aside }) => {
  if (isError) {
    return (
      <TableCard>
        <SectionError />
      </TableCard>
    )
  }

  if (isLoading) {
    return (
      <TileRow>
        {BUCKETS.map((bucket) => (
          <TileBox key={bucket.status}>
            <Skeleton width="80px" height="20px" />
            <Skeleton width="48px" height="36px" />
          </TileBox>
        ))}
      </TileRow>
    )
  }

  if (!learnerCounts.all) {
    return (
      <TableCard>
        <EmptyTableMessage>No learner activity recorded yet.</EmptyTableMessage>
      </TableCard>
    )
  }

  return (
    <Root>
      <TileRow>
        {BUCKETS.map((bucket) => (
          <Tile
            key={bucket.status}
            label={bucket.label}
            value={learnerCounts[bucket.status]}
            learnersHref={learnersHref(bucket.status)}
          />
        ))}
      </TileRow>
      <NoteRow>
        <Note>A learner can appear in more than one status.</Note>
        <ArrowLink href={learnersHref()} color="red" size="small">
          View all learners <RiArrowRightLine aria-hidden="true" />
        </ArrowLink>
      </NoteRow>
      {aside}
    </Root>
  )
}

export default LearnerProgressCard
