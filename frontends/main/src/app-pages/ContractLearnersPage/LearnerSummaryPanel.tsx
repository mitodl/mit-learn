"use client"

import React from "react"
import { RiCloseLargeLine } from "@remixicon/react"
import { Drawer, styled, Typography } from "ol-components"
import { ActionButton, VisuallyHidden } from "@mitodl/smoot-design"
import { formatDate } from "ol-utilities"
import type {
  CourseRun,
  LearnerEnrollment,
  LearnerWithEnrollments,
} from "api/analytics-hooks/organizations"
import { STUB } from "@/components/B2BTable/B2BTable"
import {
  DISPLAY_STATUS_LABEL,
  getDisplayStatus,
  isWithheldStatus,
} from "./statusDisplay"

type ActivityField =
  | "days_active"
  | "videos_watched"
  | "problems_attempted"
  | "chatbot_interactions"

const ACTIVITY_FIELDS: { field: ActivityField; label: string }[] = [
  { field: "days_active", label: "Days active" },
  { field: "videos_watched", label: "Videos watched" },
  { field: "problems_attempted", label: "Problems attempted" },
  { field: "chatbot_interactions", label: "Chatbot interactions" },
]

/** Days active are distinct days within one run, so a sum would count a day active in two modules twice. */
const TOTAL_FIELDS = ACTIVITY_FIELDS.filter(
  ({ field }) => field !== "days_active",
)

/**
 * Null when any enrollment's count is null: a sum that skips a withheld run
 * would read as the learner's whole total when it is not.
 */
const sumActivity = (
  enrollments: LearnerEnrollment[],
  field: ActivityField,
): number | null => {
  let total = 0
  for (const enrollment of enrollments) {
    const value = enrollment[field]
    if (typeof value !== "number") return null
    total += value
  }
  return total
}

const latestActivity = (enrollments: LearnerEnrollment[]): string | null =>
  enrollments.reduce<string | null>(
    (latest, { last_active_on: date }) =>
      date && (!latest || date > latest) ? date : latest,
    null,
  )

const Panel = styled.div(({ theme }) => ({
  width: "440px",
  maxWidth: "100vw",
  padding: "0 24px",
  paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    padding: "0 16px",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
  },
}))

/** Sticky so the close button stays reachable; on a phone the panel is full width, leaving no backdrop to tap. */
const PanelHeader = styled.div(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  margin: "0 -24px",
  padding: "24px 24px 16px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    margin: "0 -16px",
    padding: "16px",
  },
}))

const Name = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  overflowWrap: "anywhere",
})) as typeof Typography

const Email = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  overflowWrap: "anywhere",
})) as typeof Typography

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.black,
  marginBottom: "8px",
})) as typeof Typography

const StatList = styled.dl(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px 16px",
  margin: 0,
  "& div": { display: "flex", flexDirection: "column-reverse", gap: "2px" },
  "& dt": {
    ...theme.typography.body3,
    color: theme.custom.colors.darkGray2,
  },
  "& dd": {
    ...theme.typography.subtitle1,
    color: theme.custom.colors.black,
    margin: 0,
  },
}))

const ModuleList = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: 0,
})

const ModuleItem = styled.li(({ theme }) => ({
  padding: "12px 0",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  "&:last-child": { borderBottom: "none" },
}))

const ModuleTitle = styled.div(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.black,
}))

const ModuleStatus = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  marginTop: "2px",
}))

const ModuleCounts = styled.dl(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 12px",
  margin: "6px 0 0",
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  "& div": { display: "flex", gap: "4px" },
  "& dd": { margin: 0, color: theme.custom.colors.black },
}))

const Footnote = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const Muted = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const Withheld: React.FC = () => (
  <Muted>
    <span aria-hidden="true">{STUB}</span>
    <VisuallyHidden>Withheld</VisuallyHidden>
  </Muted>
)

const Count: React.FC<{ value: number | null }> = ({ value }) =>
  typeof value !== "number" ? <Withheld /> : <>{value.toLocaleString()}</>

const moduleStatusText = (enrollment: LearnerEnrollment) => {
  const status = getDisplayStatus(enrollment)
  const label = DISPLAY_STATUS_LABEL[status]
  if (isWithheldStatus(status)) return label
  const progress =
    status === "in-progress" && enrollment.content_progress !== null
      ? ` ${Math.round(enrollment.content_progress * 100)}%`
      : ""
  const date = enrollment.last_active_on
    ? `, last active ${formatDate(enrollment.last_active_on)}`
    : ""
  return `${label}${progress}${date}`
}

type LearnerSummaryPanelProps = {
  /** Kept set while closing so the content stays through the exit animation. */
  learner: LearnerWithEnrollments | null
  courseRuns: CourseRun[]
  open: boolean
  onClose: () => void
}

const HEADING_ID = "learner-summary-heading"

const LearnerSummaryPanel: React.FC<LearnerSummaryPanelProps> = ({
  learner,
  courseRuns,
  open,
  onClose,
}) => {
  const enrollments = learner?.enrollments ?? []
  const byRun = new Map(enrollments.map((e) => [e.courserun_readable_id, e]))
  const anyWithheld = enrollments.some((e) => !e.outcomes_shared)
  const allWithheld = enrollments.every((e) => !e.outcomes_shared)
  const completed = enrollments.filter((e) => {
    const status = getDisplayStatus(e)
    return status === "completed" || status === "certificate"
  }).length
  const notEnrolled = courseRuns.filter(
    (run) => !byRun.has(run.courserun_id),
  ).length
  const lastActive = latestActivity(enrollments)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": HEADING_ID,
      }}
    >
      {learner ? (
        <Panel>
          <PanelHeader>
            <div>
              <Name component="h2" id={HEADING_ID}>
                {learner.full_name || learner.email || "Learner summary"}
              </Name>
              {learner.full_name && learner.email ? (
                <Email component="p">{learner.email}</Email>
              ) : null}
              {anyWithheld ? (
                <Footnote component="p">
                  {allWithheld
                    ? "This learner hasn’t agreed to share their progress, so their totals are hidden."
                    : "This learner hasn’t agreed to share their progress in some modules, so their totals are hidden."}
                </Footnote>
              ) : null}
            </div>
            <ActionButton
              variant="text"
              size="medium"
              onClick={onClose}
              aria-label="Close learner summary"
            >
              <RiCloseLargeLine aria-hidden="true" />
            </ActionButton>
          </PanelHeader>

          <section aria-labelledby="learner-summary-progress">
            <SectionTitle component="h3" id="learner-summary-progress">
              Progress
            </SectionTitle>
            <StatList>
              <div>
                <dt>Completed</dt>
                <dd>
                  {anyWithheld ? (
                    <Withheld />
                  ) : (
                    `${completed} of ${courseRuns.length}`
                  )}
                </dd>
              </div>
              <div>
                <dt>Not enrolled</dt>
                <dd>{notEnrolled}</dd>
              </div>
              <div>
                <dt>Last activity</dt>
                <dd>
                  {anyWithheld ? (
                    <Withheld />
                  ) : lastActive ? (
                    formatDate(lastActive)
                  ) : (
                    <Muted>No activity</Muted>
                  )}
                </dd>
              </div>
            </StatList>
          </section>

          <section aria-labelledby="learner-summary-activity">
            <SectionTitle component="h3" id="learner-summary-activity">
              Activity across modules
            </SectionTitle>
            <StatList>
              {TOTAL_FIELDS.map(({ field, label }) => (
                <div key={field}>
                  <dt>{label}</dt>
                  <dd>
                    <Count value={sumActivity(enrollments, field)} />
                  </dd>
                </div>
              ))}
            </StatList>
          </section>

          <section aria-labelledby="learner-summary-modules">
            <SectionTitle component="h3" id="learner-summary-modules">
              Modules
            </SectionTitle>
            <ModuleList>
              {courseRuns.map((run) => {
                const enrollment = byRun.get(run.courserun_id)
                return (
                  <ModuleItem key={run.courserun_id}>
                    <ModuleTitle>{run.courserun_title}</ModuleTitle>
                    <ModuleStatus>
                      {enrollment ? (
                        moduleStatusText(enrollment)
                      ) : (
                        <Muted>Not enrolled</Muted>
                      )}
                    </ModuleStatus>
                    {enrollment?.outcomes_shared ? (
                      <ModuleCounts>
                        {ACTIVITY_FIELDS.map(({ field, label }) => (
                          <div key={field}>
                            <dt>{label}</dt>
                            <dd>
                              <Count value={enrollment[field]} />
                            </dd>
                          </div>
                        ))}
                      </ModuleCounts>
                    ) : null}
                  </ModuleItem>
                )
              })}
            </ModuleList>
          </section>

          <Footnote component="p">
            Activity is counted once per day: a video played on two days counts
            twice. Chatbot interactions count each conversation with the course
            chatbot once per day, in each part of the course.
          </Footnote>
        </Panel>
      ) : null}
    </Drawer>
  )
}

export { LearnerSummaryPanel }
