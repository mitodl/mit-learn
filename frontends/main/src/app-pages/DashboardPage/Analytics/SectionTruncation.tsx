"use client"

import React from "react"
import { styled, Typography } from "ol-components"
import { Button, VisuallyHidden } from "@mitodl/smoot-design"
import { formatCount } from "./format"

/**
 * Every analytics endpoint is paged, and a page cap is invisible in the rows
 * themselves: 200 rows out of 340 look exactly like 340 out of 340. A manager
 * reading a truncated table has no way to know they are missing courses unless
 * the page says so — so it says so, and offers the rest.
 *
 * `total_count` is net of the anonymity floor (the API applies the same
 * primary-cohort gate to the count as to the rows), so it can be compared
 * against the rows on screen without ever implying there are hidden rows the
 * caller could reach by paging.
 *
 * # Why this owns an announcement
 *
 * Expanding a section keeps the old rows on screen while the larger page loads
 * (`keepPreviousData`), which is deliberate — blanking a table back to a
 * skeleton on an explicit user action is worse. But it means a click otherwise
 * produces no perceivable change at all until the rows quietly grow. The button
 * therefore reports its own in-flight state, and the result is announced once
 * it lands, so the click is observable without watching row counts.
 */

const Root = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}))

const Message = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

type SectionTruncationProps = {
  /** Rows currently rendered. */
  shown: number
  /** Rows this org has in the backing view, across every page. */
  total: number
  onShowAll: () => void
  /**
   * False once the section already holds as many rows as the API will return
   * in one response — there is nothing further to ask for, so offering a button
   * that cannot deliver the rest would be a lie.
   */
  canShowAll: boolean
  /** The expanded page is in flight; the rows on screen are the previous ones. */
  isExpanding: boolean
}

const SectionTruncation: React.FC<SectionTruncationProps> = ({
  shown,
  total,
  onShowAll,
  canShowAll,
  isExpanding,
}) => {
  const [hasExpanded, setHasExpanded] = React.useState(false)

  /**
   * Derived from render state rather than detected as a rising/falling edge in
   * an effect. An edge detector has to observe the in-flight render to arm
   * itself, and React is free to batch a fast resolution into a single commit —
   * so on a warm cache the announcement would silently never fire. This says
   * "the user asked to expand, and we are no longer loading", which is true in
   * either case.
   */
  const announcement =
    !hasExpanded || isExpanding
      ? ""
      : shown >= total
        ? `Now showing all ${formatCount(total)} rows.`
        : `Showing ${formatCount(shown)} of ${formatCount(total)} rows.`

  return (
    <>
      {/* Rendered even once the section is complete, so the announcement of
          that completion has somewhere to land — a live region that unmounts
          in the same commit as the change it describes announces nothing. */}
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </VisuallyHidden>
      {shown < total ? (
        <Root>
          <Message>
            Showing {formatCount(shown)} of {formatCount(total)}.
          </Message>
          {canShowAll ? (
            <Button
              variant="tertiary"
              size="small"
              // aria-disabled rather than disabled: a disabled button drops
              // focus, which strands a keyboard user mid-action.
              aria-disabled={isExpanding}
              aria-busy={isExpanding}
              onClick={() => {
                if (isExpanding) return
                setHasExpanded(true)
                onShowAll()
              }}
            >
              {isExpanding ? "Loading…" : `Show all ${formatCount(total)}`}
            </Button>
          ) : null}
        </Root>
      ) : null}
    </>
  )
}

export default SectionTruncation
export type { SectionTruncationProps }
