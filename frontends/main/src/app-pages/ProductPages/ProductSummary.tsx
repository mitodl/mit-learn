import React, { HTMLAttributes, useState } from "react"
import { ActionButton, Alert, styled } from "@mitodl/smoot-design"
import { Dialog, Link, Skeleton, Stack, Typography } from "ol-components"
import type { StackProps } from "ol-components"
import {
  RiCalendarLine,
  RiComputerLine,
  RiTimeLine,
  RiFileCopy2Line,
  RiInformation2Line,
} from "@remixicon/react"
import { formatDate, LocalDate, NoSSR, pluralize } from "ol-utilities"
import type {
  CourseWithCourseRunsSerializerV2,
  CourseRunV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { HeadingIds, getTotalRequiredCourses } from "./util"
import {
  getCourseScenario,
  runStartsAnytime,
  byStartDateDesc,
} from "./courseRun"

const ResponsiveLink = styled(Link)(({ theme }) => ({
  ...theme.typography.body2, // override default for "black" color is subtitle2
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

const UnderlinedLink = styled(ResponsiveLink)({
  textDecoration: "underline",
})

const InfoRow = styled.div(({ theme }) => ({
  width: "100%",
  display: "flex",
  gap: "8px",
  alignItems: "flex-start",
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body2,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body3,
  },
}))

/**
 * Centers an icon within a flex row. Uses height matching the text line-height
 * so that flex-start alignment on the parent keeps it pinned to the first line.
 */
const InfoRowIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  height: theme.typography.body2.lineHeight,
  [theme.breakpoints.down("sm")]: {
    height: theme.typography.body3.lineHeight,
  },
  flexShrink: 0,
  "> svg": {
    width: "20px",
    height: "20px",
  },
}))

const InfoRowInner: React.FC<Pick<StackProps, "children" | "flexWrap">> = (
  props,
) => (
  <Stack
    width="100%"
    direction="row"
    gap="12px"
    justifyContent="space-between"
    flexWrap="wrap"
    {...props}
  />
)

const InfoLabel = styled.span<{
  underline?: boolean
  variant?: "light" | "normal"
}>(({ theme, underline, variant = "normal" }) => [
  variant === "normal" && {
    fontWeight: theme.typography.fontWeightBold,
  },
  variant === "light" && {
    color: theme.custom.colors.silverGrayDark,
  },
  underline && { textDecoration: "underline" },
])
const InfoLabelValue: React.FC<{
  label: React.ReactNode
  value: React.ReactNode
  labelVariant?: "light" | "normal"
}> = ({ label, value, labelVariant }) =>
  value ? (
    <span>
      <InfoLabel variant={labelVariant}>{label}</InfoLabel>
      {": "}
      {value}
    </span>
  ) : null

const dateLoading = (
  <Skeleton variant="text" sx={{ display: "inline-block" }} width="80px" />
)

/**
 * Three-column grid for the session row: [calendar icon] [Session: label]
 * [dropdown]. `alignItems: center` vertically centers the icon and label with
 * the taller (40px) dropdown. The payment deadline tucks under the dropdown
 * (column 3, second row) regardless of the label's width.
 */
const SessionRow = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto max-content 1fr",
  alignItems: "center",
  columnGap: "8px",
  rowGap: "8px",
  width: "100%",
  color: theme.custom.colors.darkGray2,
}))

const PaymentDeadline = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
}))

/**
 * Compact block of secondary lines under the session dropdown — "Start Anytime"
 * (for a self-paced, already-open selected run; the collapsed dropdown value
 * shows dates only, so the anytime nature surfaces here) and the payment
 * deadline. A tight inter-line gap keeps them reading as one unit rather than
 * two airy grid rows; the 8px from the dropdown comes from the row's rowGap.
 */
const SessionSubText = styled.div(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  display: "flex",
  flexDirection: "column",
  rowGap: "2px",
}))

type CourseInfoRowProps = {
  course: CourseWithCourseRunsSerializerV2
  nextRun?: CourseRunV2
} & HTMLAttributes<HTMLDivElement>
type NeedsNextRun = { nextRun: CourseRunV2 }
const CourseDatesRow: React.FC<
  CourseInfoRowProps & NeedsNextRun & { contentAvailableAnytime?: boolean }
> = ({ course, nextRun, contentAvailableAnytime, ...others }) => {
  const [expanded, setExpanded] = useState(false)
  const enrollable = course.courseruns
    .filter((cr) => cr.is_enrollable)
    // Latest start first; null-start runs are filtered out below.
    .sort(byStartDateDesc)

  const manyDates = enrollable.length > 1

  // Archived / deadline-passed courses are open-ended: content stays available,
  // so the single-run view leads with "available anytime" rather than a stale
  // start date, keeping the end date. (Multiple runs render their concrete
  // dates in the list.)
  if (contentAvailableAnytime && !manyDates) {
    return (
      <InfoRow {...others}>
        <InfoRowIcon>
          <RiCalendarLine aria-hidden="true" />
        </InfoRowIcon>
        <Stack gap="4px" width="100%">
          <InfoLabel>Course content available anytime</InfoLabel>
          {nextRun.end_date ? (
            <span>
              End: <LocalDate onSSR={dateLoading} date={nextRun.end_date} />
            </span>
          ) : null}
        </Stack>
      </InfoRow>
    )
  }

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiCalendarLine aria-hidden="true" />
      </InfoRowIcon>
      <Stack gap="16px" width="100%">
        {manyDates ? (
          <InfoRowInner>
            <InfoLabel>Dates Available</InfoLabel>
            <UnderlinedLink
              target="_blank"
              rel="noopener noreferrer"
              color="black"
              href=""
              role="button"
              onClick={(event) => {
                event.preventDefault()
                setExpanded((current) => !current)
              }}
            >
              {expanded ? "Show Less" : "More Dates"}
            </UnderlinedLink>
          </InfoRowInner>
        ) : null}
        {enrollable
          .filter((cr) => expanded || cr.id === nextRun.id)
          .filter((cr) => cr.start_date)
          .map((cr) => {
            const anytime = runStartsAnytime(cr)
            const labelVariant = manyDates ? "light" : "normal"
            return (
              <Stack
                key={cr.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                data-testid="date-entry"
              >
                <InfoLabelValue
                  label="Start"
                  value={
                    anytime ? (
                      "Anytime"
                    ) : (
                      <LocalDate onSSR={dateLoading} date={cr.start_date} />
                    )
                  }
                  labelVariant={labelVariant}
                />
                {cr.end_date ? (
                  <InfoLabelValue
                    label="End"
                    value={<LocalDate onSSR={dateLoading} date={cr.end_date} />}
                    labelVariant={labelVariant}
                  />
                ) : null}
              </Stack>
            )
          })}
      </Stack>
    </InfoRow>
  )
}

type LearnMoreDialogProps = {
  buttonText?: string
  href: string
  description: string
  title: string
  iconOnly?: boolean
}

/**
 * Centers an icon button inline within flowing text. Uses verticalAlign to
 * align itself on the line box (works because inline-flex is inline-level).
 */
const ButtonContainer = styled.span(({ theme }) => ({
  marginLeft: "8px",
  // center container within text
  display: "inline-flex",
  verticalAlign: "middle",
  height: theme.typography.body2.lineHeight,
  [theme.breakpoints.down("sm")]: {
    height: theme.typography.body3.lineHeight,
  },
  // center icon in container
  alignItems: "center",
  "> button": {
    color: theme.custom.colors.silverGrayDark,
  },
}))

const LearnMoreDialog: React.FC<LearnMoreDialogProps> = ({
  buttonText,
  href,
  description,
  title,
  iconOnly = false,
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      {iconOnly ? (
        <ButtonContainer>
          <ActionButton
            size="small"
            onClick={() => setOpen(true)}
            aria-label={title}
            variant="text"
          >
            <RiInformation2Line aria-hidden="true" />
          </ActionButton>
        </ButtonContainer>
      ) : (
        <UnderlinedLink
          target="_blank"
          rel="noopener noreferrer"
          color="black"
          href=""
          role="button"
          onClick={(event) => {
            event.preventDefault()
            setOpen(true)
          }}
        >
          {buttonText}
        </UnderlinedLink>
      )}
      <Dialog
        onClose={() => setOpen(false)}
        open={open}
        title={title}
        actions={null}
      >
        <Typography sx={{ marginBottom: "16px" }}>{description}</Typography>
        <UnderlinedLink
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          color="black"
        >
          Learn More
        </UnderlinedLink>
      </Dialog>
    </>
  )
}

const SELF_PACED = "self_paced"
const INSTRUCTOR_PACED = "instructor_paced"

const PACE_DATA = {
  [INSTRUCTOR_PACED]: {
    label: "Instructor-Paced",
    description:
      "Guided learning. Follow a set schedule with specific due dates for assignments and exams. Course materials released on a schedule. Earn your certificate shortly after the course ends.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994938130075-What-are-Instructor-Paced-courses-on-MITx-Online",
  },
  [SELF_PACED]: {
    label: "Self-Paced",
    description:
      "Flexible learning. Enroll at any time and progress at your own speed. All course materials available immediately. Adaptable due dates and extended timelines. Earn your certificate as soon as you pass the course.",
    href: "https://mitxonline.zendesk.com/hc/en-us/articles/21994872904475-What-are-Self-Paced-courses-on-MITx-Online",
  },
}

const getCourseRunPacing = (run: CourseRunV2) => {
  return run.is_self_paced || run.is_archived ? SELF_PACED : INSTRUCTOR_PACED
}
const CoursePaceRow: React.FC<CourseInfoRowProps & NeedsNextRun> = ({
  nextRun,
  ...others
}) => {
  const paceCode = getCourseRunPacing(nextRun)
  const pace = PACE_DATA[paceCode]

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiComputerLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue
          label="Format"
          value={
            <>
              {pace.label}
              <LearnMoreDialog
                href={pace.href}
                description={pace.description}
                title={`What are ${pace.label} courses?`}
                iconOnly
              />
            </>
          }
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const CourseDurationRow: React.FC<CourseInfoRowProps> = ({
  course,
  ...others
}) => {
  const duration = course.page?.length ?? ""
  const effort = course.page?.effort ?? ""
  if (!duration) return null
  const display = [duration, effort].filter(Boolean).join(", ")
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiTimeLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

enum TestIds {
  DatesRow = "dates-row",
  PaceRow = "pace-row",
  DurationRow = "duration-row",
  PriceRow = "price-row",
  RequirementsRow = "requirements-row",
  CertificateRow = "certificate-row",
}

const ArchivedAlert: React.FC = () => {
  return (
    <Alert severity="warning">
      This course is no longer active, but you can still access selected
      content.{" "}
      <LearnMoreDialog
        buttonText="Learn more"
        href="https://mitxonline.zendesk.com/hc/en-us/articles/21995114519067-What-are-Archived-courses-on-MITx-Online-"
        description="Access lectures and readings beyond the official end date. Some course assignments and exams may be unavailable. No support in course discussion forums. Cannot earn a Course Certificate."
        title="What are Archived courses?"
      />
    </Alert>
  )
}

/**
 * Flex column by default; on tablet switches to CSS multi-column so
 * metadata rows flow top-to-bottom then wrap to the next column.
 *
 * `$tabletColumns` gates that 2-column tablet layout. It only reads well when
 * the block spans the full InfoBox width; when the metadata shares a tablet row
 * with an offering box (the 2-box course case) it occupies a half-width cell, so
 * a further 2-column split would cram the rows — pass 1 there to keep it linear.
 */
const SummaryRows = styled.div<{ $tabletColumns: 1 | 2 }>(
  ({ theme, $tabletColumns }) => ({
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    [theme.breakpoints.up("md")]: {
      gap: "32px",
    },
    ...($tabletColumns === 2
      ? {
          [theme.breakpoints.between("sm", "md")]: {
            display: "block",
            columnCount: 2,
            columnGap: "48px",
            columnRule: `1px solid ${theme.custom.colors.lightGray2}`,
            "> *": {
              breakInside: "avoid",
              marginBottom: "24px",
              "&:last-child": {
                marginBottom: 0,
              },
            },
          },
        }
      : {}),
  }),
)

const CourseSummary: React.FC<{
  course: CourseWithCourseRunsSerializerV2
  selectedRun: CourseRunV2 | undefined
  sessionSelect?: React.ReactNode
  /** Tablet metadata column count — 1 when the block is half-width (see SummaryRows). */
  tabletColumns: 1 | 2
}> = ({ course, selectedRun, sessionSelect, tabletColumns }) => {
  const scenario = getCourseScenario(selectedRun)
  // Archived courses have no live schedule, so the date row leads with "content
  // available anytime" + end date instead of dates. A deadline-passed run is
  // still an active, scheduled run — it keeps its normal date row (dropdown /
  // "anytime" / dated); only the now-stale payment-deadline line is dropped,
  // since the "Certificate deadline has passed." alert conveys that.
  const contentAvailableAnytime = scenario.status === "archived"
  const selectedRunStartsAnytime = !!(
    selectedRun && runStartsAnytime(selectedRun)
  )
  // Any degraded status (archived or deadline-passed) drops the stale
  // payment-deadline line — the warning alert conveys the closure instead.
  const suppressPaymentDeadline = scenario.status !== "active"
  const upgradeDeadline =
    selectedRun !== undefined && !suppressPaymentDeadline
      ? selectedRun.upgrade_deadline
      : null
  const deadlineContent = upgradeDeadline ? (
    <>
      Payment deadline:{" "}
      <NoSSR onSSR={dateLoading}>{formatDate(upgradeDeadline)}</NoSSR>
    </>
  ) : null

  return (
    <SummaryRows $tabletColumns={tabletColumns}>
      {selectedRun ? (
        <CoursePaceRow
          course={course}
          nextRun={selectedRun}
          data-testid={TestIds.PaceRow}
        />
      ) : null}
      <CourseDurationRow
        course={course}
        nextRun={selectedRun}
        data-testid={TestIds.DurationRow}
      />
      {selectedRun ? (
        sessionSelect ? (
          <SessionRow data-testid={TestIds.DatesRow}>
            <InfoRowIcon>
              <RiCalendarLine aria-hidden="true" />
            </InfoRowIcon>
            {sessionSelect}
            {selectedRunStartsAnytime || deadlineContent ? (
              <SessionSubText style={{ gridColumn: 3 }}>
                {selectedRunStartsAnytime ? <div>Start Anytime</div> : null}
                {deadlineContent ? <div>{deadlineContent}</div> : null}
              </SessionSubText>
            ) : null}
          </SessionRow>
        ) : (
          <Stack gap="8px" width="100%">
            <CourseDatesRow
              course={course}
              nextRun={selectedRun}
              contentAvailableAnytime={contentAvailableAnytime}
              data-testid={TestIds.DatesRow}
            />
            {deadlineContent ? (
              <PaymentDeadline style={{ paddingLeft: "28px" }}>
                {deadlineContent}
              </PaymentDeadline>
            ) : null}
          </Stack>
        )
      ) : null}
      {/* Degraded-state notices sit at the bottom of the metadata block,
          immediately above the offerings they qualify, so the warning reads as
          context for the enrollment choices below it. */}
      {!selectedRun ? (
        <Alert severity="warning">
          No sessions of this course are currently open for enrollment. More
          sessions may be added in the future.
        </Alert>
      ) : null}
      {scenario.status === "archived" ? <ArchivedAlert /> : null}
      {scenario.status === "deadlinePassed" ? (
        <Alert severity="warning">Certificate deadline has passed.</Alert>
      ) : null}
    </SummaryRows>
  )
}

type ProgramInfoRowProps = {
  program: V2ProgramDetail
} & HTMLAttributes<HTMLDivElement>

const RequirementsRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const totalRequired = getTotalRequiredCourses(program)
  if (totalRequired === 0) return null

  // Always say "Courses" here. Whether a child program should be labeled
  // as a "course" or "program" depends on its display_mode, which can't be
  // determined from the req_tree alone. The important use cases are course
  // and course-like program (display_mode="Course") children only.
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiFileCopy2Line aria-hidden="true" />
      </InfoRowIcon>

      <InfoRowInner>
        <ResponsiveLink color="black" href={`#${HeadingIds.Requirements}`}>
          <InfoLabel underline>
            {`${totalRequired} ${pluralize("Course", totalRequired)}`}
          </InfoLabel>{" "}
          to complete program
        </ResponsiveLink>
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramDurationRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  const duration = program.page?.length ?? ""
  const effort = program.page?.effort ?? ""
  if (!duration) return null
  const display = [duration, effort].filter(Boolean).join(", ")

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiTimeLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue label="Estimated" value={display} />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramDatesRow: React.FC<ProgramInfoRowProps> = ({
  program,
  ...others
}) => {
  if (!program.start_date && !program.end_date) return null

  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiCalendarLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        {program.start_date ? (
          <InfoLabelValue
            label="Start"
            value={<LocalDate onSSR={dateLoading} date={program.start_date} />}
          />
        ) : null}
        {program.end_date ? (
          <InfoLabelValue
            label="End"
            value={<LocalDate onSSR={dateLoading} date={program.end_date} />}
          />
        ) : null}
      </InfoRowInner>
    </InfoRow>
  )
}

const getProgramPacing = (
  programCourses: CourseWithCourseRunsSerializerV2[],
) => {
  const programCourseRuns = programCourses
    .map((c) => c.courseruns.find((cr) => cr.id === c.next_run_id))
    .filter((cr) => cr !== undefined)

  if (programCourseRuns.length === 0) return null
  return programCourseRuns.every((cr) => getCourseRunPacing(cr) === SELF_PACED)
    ? SELF_PACED
    : INSTRUCTOR_PACED
}

const ProgramPaceRow: React.FC<
  {
    courses?: CourseWithCourseRunsSerializerV2[]
  } & HTMLAttributes<HTMLDivElement>
> = ({ courses, ...others }) => {
  const paceCode = courses?.length ? getProgramPacing(courses) : null
  const pace = paceCode ? PACE_DATA[paceCode] : null
  if (!pace) return null
  return (
    <InfoRow {...others}>
      <InfoRowIcon>
        <RiComputerLine aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue
          label="Course Format"
          value={
            <>
              {pace.label}
              <LearnMoreDialog
                href={pace.href}
                description={pace.description}
                title={`What are ${pace.label} courses?`}
                iconOnly
              />
            </>
          }
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const CertificateRow: React.FC<HTMLAttributes<HTMLDivElement>> = (props) => {
  return (
    <InfoRow {...props}>
      <InfoRowIcon>
        <RiFileCopy2Line aria-hidden="true" />
      </InfoRowIcon>
      <InfoRowInner>
        <InfoLabelValue
          label="Certificate"
          value="Program certificate on completion"
        />
      </InfoRowInner>
    </InfoRow>
  )
}

const ProgramSummary: React.FC<{
  program: V2ProgramDetail
  /**
   * Avoid using this. Ideally, ProgramSummary should be based on `program` data.
   */
  courses?: CourseWithCourseRunsSerializerV2[]
  /** Tablet metadata column count — 1 when the block is half-width (see SummaryRows). */
  tabletColumns: 1 | 2
}> = ({ program, courses, tabletColumns }) => {
  return (
    <SummaryRows $tabletColumns={tabletColumns}>
      <RequirementsRow
        program={program}
        data-testid={TestIds.RequirementsRow}
      />
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      {program.certificate_available ? (
        <CertificateRow data-testid={TestIds.CertificateRow} />
      ) : null}
    </SummaryRows>
  )
}

const ProgramAsCourseSummary: React.FC<{
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  /** Tablet metadata column count — 1 when the block is half-width (see SummaryRows). */
  tabletColumns: 1 | 2
}> = ({ program, courses, tabletColumns }) => {
  return (
    <SummaryRows $tabletColumns={tabletColumns}>
      <ProgramPaceRow courses={courses} data-testid={TestIds.PaceRow} />
      <ProgramDurationRow program={program} data-testid={TestIds.DurationRow} />
      <ProgramDatesRow program={program} data-testid={TestIds.DatesRow} />
    </SummaryRows>
  )
}

export {
  CourseSummary,
  ProgramSummary,
  ProgramAsCourseSummary,
  UnderlinedLink,
  TestIds,
}
