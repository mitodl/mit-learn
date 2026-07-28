"use client"

import React from "react"
import { styled, Typography } from "ol-components"
import { Button } from "@mitodl/smoot-design"
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
}

const SectionTruncation: React.FC<SectionTruncationProps> = ({
  shown,
  total,
  onShowAll,
  canShowAll,
}) => {
  if (shown >= total) {
    return null
  }

  return (
    <Root>
      <Message>
        Showing {formatCount(shown)} of {formatCount(total)}.
      </Message>
      {canShowAll ? (
        <Button variant="tertiary" size="small" onClick={onShowAll}>
          Show all {formatCount(total)}
        </Button>
      ) : null}
    </Root>
  )
}

export default SectionTruncation
export type { SectionTruncationProps }
