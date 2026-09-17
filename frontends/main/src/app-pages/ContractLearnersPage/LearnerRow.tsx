"use client"

import React from "react"
import { styled, Typography } from "ol-components"
import { initials } from "ol-utilities"
import type { LearnerProgress } from "api/analytics-hooks/organizations"
import {
  CellText,
  MobileLabel,
  TableCell,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import { DISPLAY_STATUS_LABEL, getDisplayStatus } from "./statusDisplay"
import { COLUMN_FLEX } from "./columns"

// --- Disabled: selection + Send reminder ---------------------------------
//
// Row selection exists only to feed the bulk "Send reminder" action, and no
// endpoint can nudge an enrolled learner: MITx Online's remind mutation
// resends the claim email for an *unredeemed* seat code, and every row here
// belongs to someone who already redeemed one (see hq-XXXX, filed for a real
// endpoint). Commented out rather than removed so the UI is ready to turn
// back on once that endpoint exists — restore this block and the matching
// one in ContractLearnersPage.tsx together.
//
// import { MuiCheckbox } from "ol-components"
// import { Button } from "@mitodl/smoot-design"
//
// /**
//  * ol-components' MUI re-export rather than smoot-design's Checkbox, which
//  * takes neither an `aria-label` nor an `id` — its props are `{label, value,
//  * name, checked, onChange, className, disabled}`. A row checkbox has no
//  * visible label, so through that component it would reach assistive tech
//  * unnamed. Swap back once smoot-design can name one.
//  */
// const SelectCheckbox = styled(MuiCheckbox)(({ theme }) => ({
//   padding: "8px",
//   color: theme.custom.colors.silverGrayDark,
//   "&.Mui-checked": {
//     color: theme.custom.colors.mitRed,
//   },
// }))
//
// const SelectCell = styled.div(({ theme }) => ({
//   width: "40px",
//   flexShrink: 0,
//   display: "flex",
//   alignItems: "center",
//   [theme.breakpoints.down("md")]: {
//     position: "absolute",
//     top: "12px",
//     left: 0,
//     width: "auto",
//   },
// }))
//
// const ActionCell = styled.div(({ theme }) => ({
//   width: "140px",
//   flexShrink: 0,
//   display: "flex",
//   justifyContent: "flex-end",
//   [theme.breakpoints.down("md")]: {
//     width: "100%",
//     justifyContent: "flex-start",
//     paddingTop: "8px",
//   },
// }))
// --------------------------------------------------------------------------

/**
 * Initials, not a photo: the analytics API returns no avatar image, and a name
 * is the only identity it carries.
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

// --- Disabled: fabricated "Needs attention" row flag ----------------------
//
// `placeholderNeedsAttention` hashes learner_id/courserun_readable_id into a
// pseudo-random verdict — it is not a real signal, and unlike Progress/Last
// activity it rendered with no visual distinction from a genuine warning.
// Restore once the backend's real `needs_attention` field ships (see
// placeholders.ts's header comment for the planned definition) — swap the
// import back to `placeholderNeedsAttention` and reinstate the JSX below.
//
// import { placeholderNeedsAttention } from "./placeholders"
//
// const NeedsAttention = styled(Typography)(({ theme }) => ({
//   ...theme.typography.subtitle4,
//   color: theme.custom.colors.mitRed,
//   display: "block",
// })) as typeof Typography
// --------------------------------------------------------------------------

// --- Disabled: fabricated Progress column ---------------------------------
//
// `placeholderProgress` fabricates a percent-complete and lesson count for
// every row. Real progress data is coming (see placeholders.ts's header
// comment for what blocks it), but until then this column is built and kept
// here rather than shipped with invented numbers — same treatment as
// selection/Send reminder above.
//
// import { ProgressBar } from "./ProgressBar"
// import { STUB } from "@/components/B2BTable/B2BTable"
// import { placeholderProgress } from "./placeholders"
//
// const ProgressGroup = styled.span({
//   display: "flex",
//   alignItems: "center",
//   gap: "12px",
// })
// --------------------------------------------------------------------------

// --- Disabled: fabricated Last activity column ----------------------------
//
// `placeholderLastActiveOn` fabricates a date; the real `last_active_on`
// field is hardcoded null by the API itself (activity data doesn't exist
// upstream yet — see placeholders.ts's header comment). Built and kept here
// rather than shipped with an invented date.
//
// import { PLACEHOLDER_ATTR, placeholderLastActiveOn } from "./placeholders"
//
// const formatDay = (iso: string | null): string | null => {
//   if (!iso) return null
//   const date = new Date(iso)
//   return Number.isNaN(date.getTime())
//     ? null
//     : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
// }
// --------------------------------------------------------------------------

const MutedText = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

type LearnerRowProps = {
  row: LearnerProgress
  // rowId, selected, onToggleSelect, onSendReminder: dropped along with
  // selection + Send reminder above. Restore together.
}

const LearnerRow: React.FC<LearnerRowProps> = ({ row }) => {
  const status = getDisplayStatus(row)
  const statusLabel = DISPLAY_STATUS_LABEL[status]
  const isWithheld = status === "not-shared"
  const name = row.full_name ?? row.email ?? "Unknown learner"

  return (
    <TableRow role="row">
      {/*
      <SelectCell role="cell">
        <SelectCheckbox
          size="small"
          checked={selected}
          onChange={() => onToggleSelect(rowId)}
          inputProps={{
            "aria-label": `Select ${name}, ${row.courserun_title}`,
          }}
        />
      </SelectCell>
      */}

      <LearnerCell role="cell" $flex={COLUMN_FLEX.learner} $primary>
        <Avatar aria-hidden="true">
          {row.full_name ? initials(row.full_name) : "?"}
        </Avatar>
        <span>
          <LearnerName component="div">{name}</LearnerName>
          <CourseTitle component="div">{row.courserun_title}</CourseTitle>
        </span>
      </LearnerCell>

      <TableCell role="cell" $flex={COLUMN_FLEX.status}>
        <MobileLabel>Status:</MobileLabel>
        <CellText>
          <StatusDot $muted={isWithheld} aria-hidden="true" />
          {isWithheld ? <MutedText>{statusLabel}</MutedText> : statusLabel}
          {/*
          {needsAttention ? (
            <NeedsAttention
              component="span"
              {...{ [PLACEHOLDER_ATTR]: "needs-attention" }}
            >
              Needs attention
            </NeedsAttention>
          ) : null}
          */}
        </CellText>
      </TableCell>

      {/* Disabled: fabricated Progress column — see file header comment.
      <TableCell role="cell" $flex={COLUMN_FLEX.progress}>
        <MobileLabel>Progress:</MobileLabel>
        {progress ? (
          <ProgressGroup {...{ [PLACEHOLDER_ATTR]: "progress" }}>
            <ProgressBar percent={progress.percent} />
            <span>{progress.percent}%</span>
          </ProgressGroup>
        ) : (
          <MutedText>{STUB}</MutedText>
        )}
      </TableCell>
      */}

      {/* Disabled: fabricated Last activity column — see file header comment.
      <TableCell role="cell" $flex={COLUMN_FLEX.lastActivity}>
        <MobileLabel>Last activity:</MobileLabel>
        <CellText {...{ [PLACEHOLDER_ATTR]: "last-activity" }}>
          {formatDay(lastActiveOn) ?? <MutedText>No activity</MutedText>}
          {progress ? (
            <CellText>
              <MutedText>
                {progress.lessonsCompleted} / {progress.lessonsTotal} lessons
              </MutedText>
            </CellText>
          ) : null}
        </CellText>
      </TableCell>
      */}

      {/*
      <ActionCell role="cell">
        <Button
          size="small"
          variant="bordered"
          onClick={() => onSendReminder([rowId])}
        >
          Send reminder
        </Button>
      </ActionCell>
      */}
    </TableRow>
  )
}

export { LearnerRow }
