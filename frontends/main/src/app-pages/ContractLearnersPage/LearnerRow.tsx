"use client"

import React from "react"
import { RiUserLine } from "@remixicon/react"
import { alpha, Chip, styled, Typography } from "ol-components"
import { formatDate, initials } from "ol-utilities"
import type { LearnerProgress } from "api/analytics-hooks/organizations"
import {
  CellText,
  MobileLabel,
  STUB,
  TableCell,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"
import { COLUMN_FLEX } from "./columns"

/**
 * Initials, not a photo: the analytics API returns no avatar image. Without a
 * name, a generic person icon — email-derived initials are wrong for addresses
 * like `jdoe@` or `x7k2m@`.
 */
const Avatar = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.lightGray2,
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle3,
}))

const LearnerCell = styled(TableCell)({
  display: "flex",
  alignItems: "center",
  gap: "12px",
})

const LearnerName = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  overflow: "hidden",
  textOverflow: "ellipsis",
})) as typeof Typography

const LearnerEmail = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  overflow: "hidden",
  textOverflow: "ellipsis",
})) as typeof Typography

const CourseTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  overflow: "hidden",
  textOverflow: "ellipsis",
})) as typeof Typography

const StatusDot = styled.span<{ $muted: boolean }>(({ $muted, theme }) => ({
  display: "inline-block",
  width: "8px",
  height: "8px",
  flexShrink: 0,
  marginRight: "8px",
  backgroundColor: $muted
    ? theme.custom.colors.silverGray
    : theme.custom.colors.darkGray2,
}))

/**
 * The seat-status badge from `ContractAdminPage`, in its alert treatment, so
 * the two B2B tables spell a badge the same way. `alpha` because the Figma
 * spec sets opacity on the base colour rather than naming a tint.
 *
 * `display: flex` makes it a block-level box, which is what puts it on its
 * own line under the status: `CellText` is a block whose other children are
 * inline, and a Chip is `inline-flex` by default. Its own line rather than
 * beside the status because needing attention overlaps every completion
 * status instead of replacing one — a stale `In progress` row carries both.
 */
const NeedsAttentionBadge = styled(Chip)(({ theme }) => ({
  height: "20px",
  borderRadius: "4px",
  paddingRight: "8px",
  paddingLeft: "8px",
  marginTop: "4px",
  display: "flex",
  width: "fit-content",
  ...theme.typography.body3,
  fontWeight: theme.typography.fontWeightBold as number,
  backgroundColor: alpha(theme.custom.colors.red, 0.2),
  color: theme.custom.colors.red,
}))

const MutedText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

type LearnerRowProps = {
  row: LearnerProgress
}

const LearnerRow: React.FC<LearnerRowProps> = ({ row }) => {
  const status = getDisplayStatus(row)
  const statusLabel = DISPLAY_STATUS_LABEL[status]
  const isWithheld = status === "not-shared"
  const name = row.full_name?.trim() || null

  /**
   * Withheld and never-active are different facts, so they read differently: a
   * consent-withheld row gets the same muted stub as every other hidden
   * outcome, while a consenting learner with nothing recorded says so.
   *
   * `formatDate` (moment) rather than `new Date`, which takes this field's
   * date-only value as UTC midnight and renders the day before west of
   * Greenwich — see `LearnerProgress.last_active_on`. The year is kept because
   * last activity is often long past, and a bare "Sep 30" reads as recent
   * whether it was last month or two years ago.
   */
  const lastActivity = isWithheld
    ? { text: STUB, muted: true }
    : row.last_active_on
      ? { text: formatDate(row.last_active_on), muted: false }
      : { text: "No activity", muted: true }

  return (
    <TableRow role="row">
      <LearnerCell role="cell" $flex={COLUMN_FLEX.learner} $primary>
        <Avatar aria-hidden="true">
          {name ? initials(name) : <RiUserLine size={16} />}
        </Avatar>
        <span>
          {name && <LearnerName component="div">{name}</LearnerName>}
          {row.email && (
            <LearnerEmail component="div">{row.email}</LearnerEmail>
          )}
          <CourseTitle component="div">{row.courserun_title}</CourseTitle>
        </span>
      </LearnerCell>

      <TableCell role="cell" $flex={COLUMN_FLEX.status}>
        <MobileLabel>Status:</MobileLabel>
        <CellText>
          <StatusDot $muted={isWithheld} aria-hidden="true" />
          {isWithheld ? <MutedText>{statusLabel}</MutedText> : statusLabel}
          {/* Null, not false, on a withheld row — so a truthy check is also
              what keeps this off a "No consent given" row. */}
          {row.needs_attention ? (
            <NeedsAttentionBadge label="Needs attention" />
          ) : null}
        </CellText>
      </TableCell>

      <TableCell role="cell" $flex={COLUMN_FLEX.lastActivity}>
        <MobileLabel>Last activity:</MobileLabel>
        <CellText>
          {lastActivity.muted ? (
            <MutedText>{lastActivity.text}</MutedText>
          ) : (
            lastActivity.text
          )}
        </CellText>
      </TableCell>
    </TableRow>
  )
}

export { LearnerRow }
